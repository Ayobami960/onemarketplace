import { verifyToken } from "@clerk/backend"
import type { RequestHandler } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { env } from "../config/env.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../config/constants.js";
import { redis } from "../config/redis.js";
import { db } from "../database/clients.js";
import { accounts } from "../database/schema.js";
import { and, eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";

const accountRoles = ["client", "freelancer"] as const;
type AccountRole = (typeof accountRoles)[number];


interface CachedAccountAuth {
    userId: string;
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
    emailVerified: boolean;
}

const isAccountRole = (value: unknown): value is AccountRole =>
    typeof value === "string" &&
    accountRoles.some((accountRole) => accountRole === value);


const getBearerToken = (authorizationHeader: string | undefined) => {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null;
    }

    const token = authorizationHeader?.slice("Bearer ".length).trim();
    return token || null;
};

const getClerkSecretKey = () => {
    if (!env.clerkSecretKey) {
        throw new ApiError(500, "Clerk secret key is not configured.");
    }

    return env.clerkSecretKey;
};

const getClerkClient = () => createClerkClient({ secretKey: getClerkSecretKey() });

/**
 * Returns true when Clerk considers at least one of the user's email
 * addresses verified, using the same rule as receiveSignup.
 */
function isClerkEmailVerified(
    userId: string,
): Promise<boolean> {
    return (async () => {
        try {
            const clerk = getClerkClient();
            const user = await clerk.users.getUser(userId);
            return user.emailAddresses.some(
                (addr) => addr.verification?.status === "verified",
            );
        } catch (error) {
            console.warn(
                "Could not verify Clerk email status for protected route; denying access.",
                error,
            );
            return false;
        }
    })();
}

const isAccountAvailable = async (
    requestedRole: "client" | "freelancer",
    userId: string,
): Promise<CachedAccountAuth> => {
    const cacheKey = getAccountAuthCacheKey(userId, requestedRole);
    let cachedValue: string | null = null;

    try {
        cachedValue = redis.isReady ? await redis.get(cacheKey) : null;
    } catch (error) {
        console.warn("Auth cache read failed; falling back to database.", error);
    }

    if (cachedValue) {
        return JSON.parse(cachedValue) as CachedAccountAuth;
    }

    const databaseRole = requestedRole === "client" ? "CLIENT" : "FREELANCER";

    const [account] = await db.select({ isOnboardingComplete: accounts.isOnboardingComplete })
        .from(accounts)
        .where(and(eq(accounts.auth_id, userId), eq(accounts.role, databaseRole)))
        .limit(1);

        const accountExists = Boolean(account);

        // For protected dashboard routes we require BOTH a local DB row AND
        // a verified Clerk email. This is the second half of the correctness
        // fix: previously the middleware trusted `accountExists` alone, so a
        // verified Clerk account with a missing DB row (e.g. because the
        // network dropped during the first sign-up POST) could still reach
        // the dashboard.
        const emailVerified = accountExists
            ? await isClerkEmailVerified(userId)
            : false;

        const accountAuth: CachedAccountAuth = {
            userId,
            accountExists,
            role: requestedRole,
            isOnboarded: account?.isOnboardingComplete === true,
            emailVerified,
        };

        // setting a expiring date

        try {
            if (redis.isReady) {
                await redis.setEx(
                    cacheKey,
                    ACCOUNT_AUTH_CACHE_TTL_SECONDS,
                    JSON.stringify(accountAuth)
                );
            }
        } catch (error) {
            console.warn("Auth cache write failed.", error);
        }

        return accountAuth;
};


export const isAuthenticated: RequestHandler = asyncHandler(
    async (request, _response, next) => {
        const token = getBearerToken(request?.headers.authorization);
        const requestedRole = request.body?.role ?? request?.query.role;

        if (!token) {
            throw new ApiError(401, "Please do login to access this API!");
        }

        if (!isAccountRole(requestedRole)) {
            throw new ApiError(401, "a Valid account role is required.");

        }

        const secretKey = getClerkSecretKey();
        let claims: Awaited<ReturnType<typeof verifyToken>>;


        try {
            claims = await verifyToken(token, {
                secretKey,
            });

        } catch (error) {
            throw new ApiError(401, "Authentication token is invalid or expired")
        }

        const accountAuth = await isAccountAvailable(requestedRole, claims.sub)

        // Protected routes (dashboard, profile, etc.) require BOTH:
        //   1. A local DB row for (auth_id, role), and
        //   2. A verified Clerk email.
        // This guarantees the dashboard is unreachable unless both are true,
        // even if one side was updated out of band (e.g. a webhook that ran
        // but the DB row has not been created yet).
        if (!accountAuth.accountExists || !accountAuth.emailVerified) {
            throw new ApiError(
                403,
                "This account is not ready yet. Please verify your email and try again.",
            );
        }

        request.auth = {
            userId: claims.sub,
            ...(typeof claims.sid === "string" ? { sessionId: claims.sid } : {}),
            role: requestedRole,
            accountExists: accountAuth.accountExists,
            isOnboarded: accountAuth.isOnboarded,

        };

        next();
    },
)

export const isSignupAuthenticated: RequestHandler = asyncHandler(
    async (request, _response, next) => {
        const token = getBearerToken(request.headers.authorization);
        const requestedRole = request.body?.role ?? request.query.role;

        if (!token) {
            throw new ApiError(401, "Authentication is required.");
        }

        if (!isAccountRole(requestedRole)) {
            throw new ApiError(400, "A valid account role is required.");
        }

        const secretKey = getClerkSecretKey();
        let claims: Awaited<ReturnType<typeof verifyToken>>;

        try {
            claims = await verifyToken(token, {
                secretKey,
            });
        } catch {
            throw new ApiError(401, "Authentication token is invalid or expired.");
        }

        const clerk = getClerkClient();
        const user = await clerk.users.getUser(claims.sub);
        const recordedRole =
            user.unsafeMetadata?.role ?? user.unsafeMetadata?.signupRole;

        if (recordedRole !== requestedRole) {
            throw new ApiError(403, "The account role does not match the signup session.");
        }

        request.auth = {
            userId: claims.sub,
            ...(typeof claims.sid === "string" ? { sessionId: claims.sid } : {}),
            role: requestedRole,
            accountExists: false,
            isOnboarded: false,
        };

        next();
    },
);
