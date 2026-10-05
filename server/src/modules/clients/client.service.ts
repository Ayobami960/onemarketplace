import { and, eq } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, client_metadata } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";


export interface SaveClientProfileInput {
    userId: string;
    firstName: string;
    lastName: string;
    country: string;
    avatarUrl: string;
    professionalRole: string;
    companyName: string;
    companyWebsite: string;
    companySize: string;
    industry: string;
    companyDescription: string;
}

export interface ClientMetadataData {
    firstName: string;
    lastName: string;
    country: string;
    avatarUrl: string;
    professionalRole: string;
    companyName: string;
    companyWebsite: string;
    companySize: string;
    industry: string;
    companyDescription: string;
    joinedAt: Date | null;
    identityVerified: boolean;
    paymentMethodVerified: boolean;

}


export interface ClientProfileData extends ClientMetadataData {
    isOnboarded: true
}

export const getClientProfile = async (
    userId: string
): Promise<ClientMetadataData | null> => {
    const [profile] = await db.select({
        firstName: client_metadata.first_name,
        lastName: client_metadata.last_name,
        country: client_metadata.country,
        avatarUrl: client_metadata.avatar_url,
        accountFirstName: accounts.first_name,
        accountLastName: accounts.last_name,
        accountCountry: accounts.country,
        professionalRole: client_metadata.role,
        companyName: client_metadata.company_name,
        companyWebsite: client_metadata.company_website,
        companySize: client_metadata.company_size,
        industry: client_metadata.industry,
        companyDescription: client_metadata.company_description,
        joinedAt: client_metadata.created_at,
        accountJoinedAt: accounts.created_at,
        identityVerified: accounts.identityVerified,
        paymentMethodVerified: accounts.paymentMethodVerified
    })
        .from(accounts)
        .leftJoin(client_metadata, eq(accounts.auth_id, client_metadata.auth_id))
        .where(and(eq(accounts.auth_id, userId), eq(accounts.role, "CLIENT")))
        .limit(1);

    if (!profile) return null;

    return {
        firstName: profile.firstName ?? profile.accountFirstName ?? "",
        lastName: profile.lastName ?? profile.accountLastName ?? "",
        country: profile.country ?? profile.accountCountry ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        professionalRole: profile.professionalRole ?? "",
        companyName: profile.companyName ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        companySize: profile.companySize ?? "",
        industry: profile.industry ?? "",
        companyDescription: profile.companyDescription ?? "",
        joinedAt: profile.joinedAt ?? profile.accountJoinedAt,
        identityVerified: profile.identityVerified === true,
        paymentMethodVerified: profile.paymentMethodVerified === true
    }

}


export const saveClientProfile = async (input: SaveClientProfileInput): Promise<ClientProfileData> => {
    const now = new Date();

    const profile = await db.transaction(async (transaction) => {
        const [account] = await transaction.update(accounts).set({
            first_name: input.firstName,
            last_name: input.lastName,
            country: input.country,
            isOnboardingComplete: true,
            updated_at: now
        })
            .where(and(eq(accounts.auth_id, input.userId), eq(accounts.role, "CLIENT")),
            ).returning({
                id: accounts.id,
                identityVerified: accounts.identityVerified,
                paymentMethodVerified: accounts.paymentMethodVerified
            });

        if (!account) {
            throw new ApiError(404, "Client account not found.")
        }

        const profileValues = {
            first_name: input.firstName,
            last_name: input.lastName,
            country: input.country,
            avatar_url: input.avatarUrl || null,
            role: input.professionalRole,
            company_name: input.companyName,
            company_website: input.companyWebsite,
            company_size: input.companySize,
            industry: input.industry,
            company_description: input.companyDescription,
        };
        const returningProfile = {
            firstName: client_metadata.first_name,
            lastName: client_metadata.last_name,
            country: client_metadata.country,
            avatarUrl: client_metadata.avatar_url,
            professionalRole: client_metadata.role,
            companyName: client_metadata.company_name,
            companyWebsite: client_metadata.company_website,
            companySize: client_metadata.company_size,
            industry: client_metadata.industry,
            companyDescription: client_metadata.company_description,
            joinedAt: client_metadata.created_at,
        };
        const [existingProfile] = await transaction.select({ id: client_metadata.id })
            .from(client_metadata)
            .where(eq(client_metadata.auth_id, input.userId))
            .limit(1);
        const [savedProfile] = existingProfile
            ? await transaction.update(client_metadata)
                .set({ ...profileValues, updated_at: now })
                .where(eq(client_metadata.id, existingProfile.id))
                .returning(returningProfile)
            : await transaction.insert(client_metadata)
                .values({ ...profileValues, auth_id: input.userId, created_at: now, updated_at: now })
                .returning(returningProfile);

        if(!savedProfile) {
                throw new ApiError(500, "Client profile could not be saved");
        }

        return {
            ...savedProfile,
            firstName: savedProfile.firstName ?? input.firstName,
            lastName: savedProfile.lastName ?? input.lastName,
            country: savedProfile.country ?? input.country,
            avatarUrl: savedProfile.avatarUrl ?? "",
            identityVerified: account.identityVerified === true,
            paymentMethodVerified: account.paymentMethodVerified === true,
        };
    });

    await redis.setEx(
        getAccountAuthCacheKey(input.userId, "client"),
        ACCOUNT_AUTH_CACHE_TTL_SECONDS,
        JSON.stringify({
            userId: input.userId,
            role: "client",
            accountExists: true,
            isOnboarded: true,
            emailVerified: true,
        }),
    );

    return {
        ...profile,
        isOnboarded: true
    }
};







