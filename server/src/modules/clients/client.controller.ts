import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";

import { getClientProfile, saveClientProfile } from "./client.service.js";

import type { ClientMetadataData, ClientProfileData, SaveClientProfileInput } from "./client.service.js";

import type { ApiResponse } from "../../types/common.types.js";
import { requireText, requireWebsite } from "../../config/constants.js";


interface ClientProfileBody {
    firstName?: string;
    lastName?: string;
    country?: string;
    avatarUrl?: string;
    professionalRole?: string;
    companyName?: string;
    companyWebsite?: string | undefined;
    companySize?: string;
    industry?: string;
    companyDescription?: string;
}


export const getLoggedInClientProfile: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.auth){
            throw new ApiError(401, "Authentication is required.");
        }

        if (request.auth.role !== "client"){
            throw new ApiError(403, "A client account is required.")
        }

        const profile = await getClientProfile(request.auth.userId);
        const responseBody: ApiResponse<ClientMetadataData | null> = {
            success: true,
            message: profile ? "Client profile retrieved" : "Client profile has been completed",
            data: profile,
        };


        response.status(200).json(responseBody);
    },
);

export const upsertClientProfile: RequestHandler = asyncHandler (
    async (request, response) => {
        if (!request.auth){
            throw new ApiError(401, "Authentication is required.")
        }

        if(request.auth.role !== "client"){
            throw new ApiError(403, "A client account is required");
        }

        const body = request.body as ClientProfileBody;
        const avatarUrl = body.avatarUrl?.trim() ?? "";
        if (avatarUrl) {
            try {
                const url = new URL(avatarUrl);
                if (url.protocol !== "https:") throw new Error("Unsupported protocol.");
            } catch {
                throw new ApiError(400, "Profile photo URL must be a valid HTTPS URL.");
            }
        }

        const input: SaveClientProfileInput = {
            userId: request.auth.userId,
            firstName: requireText(body.firstName, "First name"),
            lastName: requireText(body.lastName, "Last name"),
            country: requireText(body.country, "Country"),
            avatarUrl,
            professionalRole: requireText(body.professionalRole, "Professional role"),
            companyName: requireText(body.companyName, "Company name"),
            companyWebsite: requireWebsite(body.companyWebsite),
            companySize: requireText(body.companySize, "Company size"),
            industry: requireText(body.industry, "industry"),
            companyDescription: requireText(
                body.companyDescription,
                "Company description",
            ),
        };

        const profile = await saveClientProfile(input);
        const responseBody: ApiResponse<ClientProfileData> = {
            success: true,
            message: "Client profile saved.",
            data: profile,
        };

        response.status(200).json(responseBody);
    },
);

