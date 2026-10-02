import { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { ClientMetadataData, ClientProfileData, getClientProfile, saveClientProfile, SaveClientProfileInput } from "./client.service.js";
import { ApiResponse } from "../../types/common.types.js";
import { requireText, requireWebsite } from "../../config/constants.js";

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


interface ClientProfileBody {
    professionalRole?: string;
    companyName?: string;
    companyWebsite?: string | undefined;
    companySize?: string;
    industry?: string;
    companyDescription?: string;
}


export const upsertClientProfile: RequestHandler = asyncHandler (
    async (request, response) => {
        if (!request.auth){
            throw new ApiError(401, "Authentication is required.")
        }

        if(request.auth.role !== "client"){
            throw new ApiError(403, "A client account is required");
        }

        const body = request.body as ClientProfileBody;
        const input: SaveClientProfileInput = {
            userId: request.auth.userId,
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

