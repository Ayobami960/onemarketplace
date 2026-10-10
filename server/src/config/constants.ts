import { ApiError } from "../utils/api-error.js";

export const API_PREFIX = "/api/v1";
export const SERVICE_NAME = "onemarketplace-services"

export const ACCOUNT_AUTH_CACHE_TTL_SECONDS = 10 * 60
export const getAccountAuthCacheKey = (
    userId: string,
    role: "client" | "freelancer",
): string => `account:auth:${userId}:${role}`;



export const requireText = (value: string | undefined, fieldName: string): string => {
    if(typeof value !== "string" || !value.trim()){
        throw new ApiError(400, `${fieldName} is required.`)
    }

    return value.trim();
};

export const requireWebsite = (value: string | undefined): string => {
    const website = requireText(value, "Company website");

    try {
        const url = new URL(website);
        if(url.protocol !== "https:"){
            throw new Error("Unsupported protocol.")
        }
    } catch (error) {
       throw new ApiError(400, "Company website must be a valid HTTP URL.") 
    }

    return website;
}


export const INITIAL_CONNECTS = 60;
export const PROPOSAL_CONNECTS = 6;


export const getConnectsCacheKey = (userId: string): string =>
    `connects:${userId}:freelancer`;


export const CONNECTS_CACHE_TTL_SECONDS =  10 * 60


export const CONNECTS_PLANS = {
    20: 300,
    40: 600,
    80: 1200,
} as const;


export type ConnectsPlan = keyof typeof CONNECTS_PLANS