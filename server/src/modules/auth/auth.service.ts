// this  is basicaly interface

import { createClerkClient, type User } from "@clerk/backend";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { db } from "../../database/clients.js";
import { accounts } from "../../database/schema.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";
import { redis } from "../../config/redis.js";
import { and, eq } from "drizzle-orm";

export interface SignupInput {
    userId: string;
    sessionId?: string;
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
}

const toDatabaseRole = (role: SignupInput["role"]): "CLIENT" | "FREELANCER" => role === "client" ? "CLIENT" : "FREELANCER"

/**
 * Returns true when Clerk considers at least one of the user's email
 * addresses verified.
 *
 * The installed @clerk/backend SDK models a User as a class whose
 * `emailAddresses` are `EmailAddress` objects, each carrying a
 * `verification: Verification | null` whose `status` is one of
 * `verified` | `unverified` | `expired` | `failed` | `transferable`.
 * We treat `status === "verified"` as "the email is verified".
 *
 * This is shared by receiveSignup (synchronous sign-up POST) and the
 * Clerk webhook so both paths use the same rule.
 */
export function getVerifiedEmail(user: User): string | undefined {
    const primary = user.primaryEmailAddress;
    if (primary?.verification?.status === "verified") {
        return primary.emailAddress;
    }

    return user.emailAddresses.find(
        (addr) => addr.verification?.status === "verified",
    )?.emailAddress;
}


export const receiveSignup = async (input: SignupInput): Promise<void> => {
    if (!env.clerkSecretKey) {
        throw new ApiError(500, "Clerk secret key is not configured.");
    }

    const clerk = createClerkClient({ secretKey: env.clerkSecretKey });
    const user = await clerk.users.getUser(input.userId);
    const email = getVerifiedEmail(user);


    if (!email) {
        throw new ApiError(409, "Email verification is required before account creation.")
    }

    const now = new Date();
    let isOnboarded = false;

    try {
        await db.insert(accounts).values({
            auth_id: input.userId,
            email: email.trim().toLowerCase(),
            role: toDatabaseRole(input.role),
            identityVerified: false,
            isOnboardingComplete: false,
            created_at: now,
            updated_at: now
        })
            .onConflictDoNothing({
                target: accounts.auth_id,
            })

        const [account] = await db.select({
            id: accounts.id,
            email: accounts.email,
            isOnboardingComplete: accounts.isOnboardingComplete,
        })
            .from(accounts)
            .where(and(
                eq(accounts.auth_id, input.userId),
                eq(accounts.role, toDatabaseRole(input.role)),
            ))
            .limit(1);

        if (!account) {
            throw new Error("Account insert completed without an account row.");
        }

        isOnboarded = account.isOnboardingComplete === true;

        if (account.email !== email.trim().toLowerCase()) {
            await db.update(accounts)
                .set({
                    email: email.trim().toLowerCase(),
                    updated_at: now,
                })
                .where(eq(accounts.id, account.id));
        }
    } catch (error) {
        console.error("AUTH_SIGNUP_FAILED", {
            clerkUserId: input.userId,
            stage: "account_creation",
            error,
        });
        throw error;
    }


    try {
        if (redis.isReady) {
            await redis.setEx(
                getAccountAuthCacheKey(input.userId, input.role),
                ACCOUNT_AUTH_CACHE_TTL_SECONDS,
                JSON.stringify({
                    userId: input.userId,
                    role: input.role,
                    accountExists: true,
                    isOnboarded,
                    emailVerified: true,
                })
            );
        }
    } catch (error) {
        console.warn("Signup account auth cache write failed; database row is authoritative.", {
            clerkUserId: input.userId,
            error,
        });
    }

}
