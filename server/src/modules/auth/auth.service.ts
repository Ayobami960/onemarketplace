import { createHmac, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { redis } from "../../config/redis.js";
import { db } from "../../database/clients.js";
import { accounts, sessions, verification_codes } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { buildOtpEmailHtml, sendEmail } from "./mailer.js";
import type { RegisterInput, LoginInput, OtpInput, ResetPasswordInput, UpdateAccountProfileInput } from "./auth.schemas.js";

const accessCookieName = "om_access";
const refreshCookieName = "om_refresh";
const accessTtlSeconds = env.accessTokenTtlSeconds;
const refreshTtlSeconds = env.refreshTokenTtlSeconds;
const otpTtlMs = 10 * 60 * 1000;
const otpCooldownMs = 60 * 1000;
const otpHourlyLimit = 5;
const maxOtpAttempts = 5;
const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);
const otpSecret = env.otpHmacSecret;
const dummyPasswordHash = argon2.hash("one-marketplace-dummy-password-value");

export interface AuthRequestContext {
    ip?: string;
    userAgent?: string;
}

export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
}

export interface SafeAccount {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    role: "client" | "freelancer";
    emailVerified: boolean;
    identityVerified: boolean;
    isOnboardingComplete: boolean;
    createdAt: Date | null;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const toRole = (role: "client" | "freelancer"): "CLIENT" | "FREELANCER" => role === "client" ? "CLIENT" : "FREELANCER";
const fromRole = (role: "CLIENT" | "FREELANCER"): "client" | "freelancer" => role === "CLIENT" ? "client" : "freelancer";
const hashRefreshToken = (token: string): string => createHash("sha256").update(token).digest("hex");
const hashOtp = (accountId: string, purpose: "email_verification" | "password_reset", code: string): string =>
    createHmac("sha256", otpSecret).update(`${accountId}:${purpose}:${code}`).digest("hex");

const issueOtp = async (accountId: string, purpose: "email_verification" | "password_reset"): Promise<string> => {
    const now = new Date();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await db.transaction(async (tx) => {
        const [account] = await tx.select({ id: accounts.id }).from(accounts)
            .where(eq(accounts.auth_id, accountId)).limit(1).for("update");
        if (!account) throw new ApiError(404, "Account not found.");
        const [latest] = await tx.select({ createdAt: verification_codes.created_at })
            .from(verification_codes)
            .where(and(eq(verification_codes.account_id, accountId), eq(verification_codes.purpose, purpose), isNull(verification_codes.consumed_at)))
            .orderBy(desc(verification_codes.created_at)).limit(1);
        if (latest && now.getTime() - latest.createdAt.getTime() < otpCooldownMs) {
            throw new ApiError(429, "Please wait before requesting another code.");
        }
        const since = new Date(now.getTime() - 60 * 60 * 1000);
        const recentCodes = await tx.select({ id: verification_codes.id }).from(verification_codes)
            .where(and(eq(verification_codes.account_id, accountId), eq(verification_codes.purpose, purpose), gt(verification_codes.created_at, since)));
        if (recentCodes.length >= otpHourlyLimit) throw new ApiError(429, "Too many codes requested. Try again later.");
        await tx.update(verification_codes)
            .set({ consumed_at: now })
            .where(and(eq(verification_codes.account_id, accountId), eq(verification_codes.purpose, purpose), isNull(verification_codes.consumed_at)));
        await tx.insert(verification_codes).values({
            account_id: accountId,
            purpose,
            code_hash: hashOtp(accountId, purpose, code),
            expires_at: new Date(now.getTime() + otpTtlMs),
            attempts: 0,
            created_at: now,
        });
    });
    return code;
};

const sendOtpEmail = async (
    email: string,
    code: string,
    purpose: "email_verification" | "password_reset",
    firstName = "there",
): Promise<void> => {
    const subject = purpose === "email_verification"
        ? "Verify your OneMarketplace email"
        : "Reset your OneMarketplace password";
    const text = `Hello ${firstName},\n\nYour OneMarketplace code is ${code}. It expires in 10 minutes. Never share this code. If you did not request this, you can ignore this email.`;
    const html = buildOtpEmailHtml({
        firstName,
        code,
        expiryMinutes: 10,
        purpose,
    });

    await sendEmail({ to: email, subject, text, html });
};

const createSession = async (accountId: string, role: "CLIENT" | "FREELANCER", context: AuthRequestContext, familyId = randomUUID()): Promise<IssuedTokens> => {
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const now = new Date();
    const [session] = await db.insert(sessions).values({
        account_id: accountId,
        family_id: familyId,
        token_hash: refreshTokenHash,
        user_agent: context.userAgent?.slice(0, 500) ?? null,
        ip: context.ip?.slice(0, 100) ?? null,
        expires_at: new Date(now.getTime() + refreshTtlSeconds * 1000),
        created_at: now,
    }).returning({ id: sessions.id });
    if (!session) throw new Error("Session insert returned no row.");
    const accessToken = await new SignJWT({ role: fromRole(role), sid: session.id })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(accountId)
        .setIssuedAt()
        .setExpirationTime(`${accessTtlSeconds}s`)
        .sign(accessSecret);
    return { accessToken, refreshToken, sessionId: session.id };
};

const safeAccount = (account: typeof accounts.$inferSelect): SafeAccount => ({
    id: account.auth_id,
    email: account.email,
    firstName: account.first_name ?? "",
    lastName: account.last_name ?? "",
    country: account.country ?? "",
    role: fromRole(account.role),
    emailVerified: account.email_verified_at !== null,
    identityVerified: account.identityVerified,
    isOnboardingComplete: account.isOnboardingComplete,
    createdAt: account.created_at ?? null,
});

export const register = async (input: RegisterInput): Promise<{ message: string }> => {
    const email = normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const country = input.country.trim();
    const now = new Date();
    const authId = randomBytes(24).toString("base64url");
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    try {
        await db.transaction(async (tx) => {
            await tx.insert(accounts).values({
                auth_id: authId,
                email,
                first_name: firstName,
                last_name: lastName,
                country,
                password_hash: passwordHash,
                email_verified_at: null,
                role: toRole(input.role),
                identityVerified: false,
                isOnboardingComplete: false,
                created_at: now,
                updated_at: now,
            });
            await tx.insert(verification_codes).values({
                account_id: authId,
                purpose: "email_verification",
                code_hash: hashOtp(authId, "email_verification", code),
                expires_at: new Date(now.getTime() + otpTtlMs),
                attempts: 0,
                created_at: now,
            });
        });
        await sendOtpEmail(email, code, "email_verification", firstName || "there");
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
            const [existingAccount] = await db.select({
                emailVerifiedAt: accounts.email_verified_at,
            }).from(accounts).where(eq(accounts.email, email)).limit(1);
            if (existingAccount && !existingAccount.emailVerifiedAt) {
                try {
                    await resendOtp(email);
                } catch (resendError) {
                    if (resendError instanceof Error && resendError.message.startsWith("Email delivery failed:")) {
                        throw new ApiError(502, "We could not send the verification code. Please try again.");
                    }
                    throw resendError;
                }
            }
            return { message: "If registration can be completed, verification instructions will be sent to the provided email." };
        }

        if (error instanceof Error && error.message.startsWith("Email delivery failed:")) {
            throw new ApiError(502, "We could not send the verification code. Please try again.");
        }

        throw error;
    }
    return { message: "If registration can be completed, verification instructions will be sent to the provided email." };
};

const findUsableCode = async (email: string, purpose: "email_verification" | "password_reset", code: string) => {
    const [account] = await db.select().from(accounts).where(eq(accounts.email, normalizeEmail(email))).limit(1);
    if (!account) throw new ApiError(400, "The code is invalid or expired.");
    const [record] = await db.select().from(verification_codes)
        .where(and(eq(verification_codes.account_id, account.auth_id), eq(verification_codes.purpose, purpose), isNull(verification_codes.consumed_at)))
        .orderBy(desc(verification_codes.created_at)).limit(1);
    if (!record || record.expires_at <= new Date() || record.attempts >= maxOtpAttempts) {
        if (record && record.attempts >= maxOtpAttempts) {
            await db.update(verification_codes).set({ consumed_at: new Date() }).where(eq(verification_codes.id, record.id));
        }
        throw new ApiError(400, "The code is invalid or expired.");
    }
    const expected = Buffer.from(record.code_hash, "hex");
    const supplied = Buffer.from(hashOtp(account.auth_id, purpose, code), "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        const [updated] = await db.update(verification_codes)
            .set({ attempts: sql`${verification_codes.attempts} + 1` })
            .where(and(eq(verification_codes.id, record.id), isNull(verification_codes.consumed_at), lt(verification_codes.attempts, maxOtpAttempts)))
            .returning({ attempts: verification_codes.attempts });
        if (updated && updated.attempts >= maxOtpAttempts) {
            await db.update(verification_codes).set({ consumed_at: new Date() }).where(eq(verification_codes.id, record.id));
        }
        throw new ApiError(400, "The code is invalid or expired.");
    }
    return { account, record };
};

export const verifyEmail = async (input: OtpInput, context: AuthRequestContext): Promise<{ tokens: IssuedTokens; account: SafeAccount }> => {
    const { account, record } = await findUsableCode(input.email, "email_verification", input.code);
    if (account.email_verified_at) throw new ApiError(400, "Email is already verified.");
    const now = new Date();
    await db.transaction(async (tx) => {
        await tx.update(accounts).set({ email_verified_at: now, updated_at: now }).where(eq(accounts.auth_id, account.auth_id));
        const [consumed] = await tx.update(verification_codes).set({ consumed_at: now })
            .where(and(eq(verification_codes.id, record.id), isNull(verification_codes.consumed_at)))
            .returning({ id: verification_codes.id });
        if (!consumed) throw new ApiError(400, "The code is invalid or expired.");
    });
    const tokens = await createSession(account.auth_id, account.role, context);
    return { tokens, account: safeAccount({ ...account, email_verified_at: now }) };
};

export const resendOtp = async (emailInput: string): Promise<void> => {
    const email = normalizeEmail(emailInput);
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!account || account.email_verified_at) return;
    try {
        const code = await issueOtp(account.auth_id, "email_verification");
        await sendOtpEmail(email, code, "email_verification", account.first_name || "there");
    } catch (error) {
        if (error instanceof ApiError && error.statusCode === 429) throw error;
        if (error instanceof Error && error.message.startsWith("Email delivery failed:")) {
            throw new ApiError(502, "We could not send the verification code. Please try again.");
        }
        throw error;
    }
};

export const login = async (input: LoginInput, context: AuthRequestContext): Promise<{ tokens: IssuedTokens; account: SafeAccount }> => {
    const email = normalizeEmail(input.email);
    if (context.ip && redis.isReady) {
        const ipKey = `auth:login:ip:${createHash("sha256").update(context.ip).digest("hex")}`;
        try {
            const count = await redis.incr(ipKey);
            if (count === 1) await redis.expire(ipKey, 15 * 60);
            if (count > 30) throw new ApiError(429, "Too many login attempts. Try again later.");
        } catch (error) {
            if (error instanceof ApiError) throw error;
        }
    }
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    const hash = account?.password_hash ?? await dummyPasswordHash;
    let passwordMatches = false;
    try {
        passwordMatches = await argon2.verify(hash, input.password);
    } catch {
        passwordMatches = false;
    }
    if (!account || !passwordMatches) {
        if (account) {
            const failureCount = account.failed_login_count + 1;
            await db.update(accounts).set({
                failed_login_count: failureCount,
                locked_until: failureCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : account.locked_until,
            }).where(eq(accounts.auth_id, account.auth_id));
        }
        throw new ApiError(401, "Invalid email or password.");
    }
    const now = new Date();
    if (account.locked_until && account.locked_until > now) throw new ApiError(429, "Too many failed attempts. Try again later.");
    if (!account.email_verified_at) throw new ApiError(403, "EMAIL_NOT_VERIFIED");
    await db.update(accounts).set({ failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now }).where(eq(accounts.auth_id, account.auth_id));
    const tokens = await createSession(account.auth_id, account.role, context);
    return { tokens, account: safeAccount({ ...account, last_login_at: now }) };
};

export const refresh = async (refreshToken: string, context: AuthRequestContext): Promise<IssuedTokens> => {
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();
    const result = await db.transaction(async (tx): Promise<IssuedTokens | { error: "reuse" }> => {
        const [existing] = await tx.select().from(sessions).where(eq(sessions.token_hash, tokenHash)).limit(1).for("update");
        if (!existing) throw new ApiError(401, "Refresh token is invalid or expired.");
        if (existing.revoked_at) {
            await tx.update(sessions).set({ revoked_at: now }).where(eq(sessions.family_id, existing.family_id));
            return { error: "reuse" as const };
        }
        if (existing.expires_at <= now) {
            await tx.update(sessions).set({ revoked_at: now }).where(eq(sessions.id, existing.id));
            throw new ApiError(401, "Refresh token is invalid or expired.");
        }
        const account = await tx.select({ role: accounts.role }).from(accounts).where(eq(accounts.auth_id, existing.account_id)).limit(1);
        if (!account[0]) throw new ApiError(401, "Refresh token is invalid or expired.");
        const newRefreshToken = randomBytes(48).toString("base64url");
        const [replacement] = await tx.insert(sessions).values({
            account_id: existing.account_id,
            family_id: existing.family_id,
            token_hash: hashRefreshToken(newRefreshToken),
            user_agent: context.userAgent?.slice(0, 500) ?? null,
            ip: context.ip?.slice(0, 100) ?? null,
            expires_at: new Date(now.getTime() + refreshTtlSeconds * 1000),
            created_at: now,
        }).returning({ id: sessions.id });
        if (!replacement) throw new Error("Session rotation returned no row.");
        await tx.update(sessions).set({ revoked_at: now, replaced_by: replacement.id }).where(eq(sessions.id, existing.id));
        const accessToken = await new SignJWT({ role: fromRole(account[0].role), sid: replacement.id })
            .setProtectedHeader({ alg: "HS256" }).setSubject(existing.account_id)
            .setIssuedAt().setExpirationTime(`${accessTtlSeconds}s`).sign(accessSecret);
        return { accessToken, refreshToken: newRefreshToken, sessionId: replacement.id };
    });
    if ("error" in result) throw new ApiError(401, "Refresh token reuse detected. Please sign in again.");
    return result;
};

export const revokeSession = async (sessionId: string | undefined): Promise<void> => {
    if (!sessionId) return;
    await db.update(sessions).set({ revoked_at: new Date() }).where(and(eq(sessions.id, sessionId), isNull(sessions.revoked_at)));
};

export const revokeByRefreshToken = async (refreshToken: string): Promise<void> => {
    await db.update(sessions).set({ revoked_at: new Date() })
        .where(and(eq(sessions.token_hash, hashRefreshToken(refreshToken)), isNull(sessions.revoked_at)));
};

export const revokeAllSessions = async (accountId: string): Promise<void> => {
    await db.update(sessions).set({ revoked_at: new Date() }).where(and(eq(sessions.account_id, accountId), isNull(sessions.revoked_at)));
};

export const authenticateAccessToken = async (token: string) => {
    try {
        const { payload } = await jwtVerify(token, accessSecret, { algorithms: ["HS256"] });
        if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || (payload.role !== "client" && payload.role !== "freelancer")) {
            throw new Error("Malformed access token.");
        }
        const [session] = await db.select({
            id: sessions.id,
            accountId: sessions.account_id,
            expiresAt: sessions.expires_at,
            revokedAt: sessions.revoked_at,
            role: accounts.role,
            isOnboarded: accounts.isOnboardingComplete,
            emailVerifiedAt: accounts.email_verified_at,
        }).from(sessions).innerJoin(accounts, eq(accounts.auth_id, sessions.account_id))
            .where(and(eq(sessions.id, payload.sid), eq(sessions.account_id, payload.sub))).limit(1);
        if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new Error("Session is unavailable.");
        return {
            userId: session.accountId,
            role: fromRole(session.role),
            sessionId: session.id,
            accountExists: true,
            isOnboarded: session.isOnboarded,
            emailVerified: session.emailVerifiedAt !== null,
        };
    } catch {
        throw new ApiError(401, "Authentication token is invalid or expired.");
    }
};

export const getMe = async (accountId: string): Promise<SafeAccount> => {
    const [account] = await db.select().from(accounts).where(eq(accounts.auth_id, accountId)).limit(1);
    if (!account) throw new ApiError(404, "Account not found.");
    return safeAccount(account);
};

export const updateAccountProfile = async (
    accountId: string,
    input: UpdateAccountProfileInput,
): Promise<SafeAccount> => {
    const [account] = await db.update(accounts).set({
        first_name: input.firstName,
        last_name: input.lastName,
        updated_at: new Date(),
    }).where(eq(accounts.auth_id, accountId)).returning();
    if (!account) throw new ApiError(404, "Account not found.");
    return safeAccount(account);
};

export const forgotPassword = async (emailInput: string): Promise<void> => {
    const email = normalizeEmail(emailInput);
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!account?.email_verified_at) return;
    try {
        const code = await issueOtp(account.auth_id, "password_reset");
        await sendOtpEmail(email, code, "password_reset");
    } catch (error) {
        if (error instanceof ApiError && error.statusCode === 429) throw error;
        if (error instanceof Error && error.message.startsWith("Email delivery failed:")) {
            throw new ApiError(502, "We could not send the password reset code. Please try again.");
        }
        throw error;
    }
};

export const resetPassword = async (input: ResetPasswordInput): Promise<void> => {
    const { account, record } = await findUsableCode(input.email, "password_reset", input.code);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const now = new Date();
    await db.transaction(async (tx) => {
        await tx.update(accounts).set({ password_hash: passwordHash, failed_login_count: 0, locked_until: null, updated_at: now }).where(eq(accounts.auth_id, account.auth_id));
        const [consumed] = await tx.update(verification_codes).set({ consumed_at: now })
            .where(and(eq(verification_codes.id, record.id), isNull(verification_codes.consumed_at)))
            .returning({ id: verification_codes.id });
        if (!consumed) throw new ApiError(400, "The code is invalid or expired.");
        await tx.update(sessions).set({ revoked_at: now }).where(and(eq(sessions.account_id, account.auth_id), isNull(sessions.revoked_at)));
    });
    await sendEmail({ to: account.email, subject: "Your OneMarketplace password was changed", text: "Your OneMarketplace password was changed. If you did not make this change, contact support immediately." });
};

export const getCookieNames = () => ({ access: accessCookieName, refresh: refreshCookieName });
export const getTokenTtls = () => ({ access: accessTtlSeconds, refresh: refreshTtlSeconds });