import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { ApiResponse } from "../../types/common.types.js";
import { imageKit } from "../../config/imageKit.js";
import { env } from "../../config/env.js";
import { toFile } from "@imagekit/nodejs";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadAvatar: RequestHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }

    const file = request.file;
    if (!file) {
        throw new ApiError(400, "A profile photo is required.");
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
        throw new ApiError(400, "Choose a JPG, PNG, or WebP image.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new ApiError(400, "Profile photos must be 5 MB or smaller.");
    }

    if (!env.imageKitPrivateKey || !env.imageKitPublicKey || !env.imageKitUrlEndpoint) {
        throw new ApiError(503, "Avatar uploads are not configured.");
    }

    let upload: Awaited<ReturnType<typeof imageKit.files.upload>>;
    try {
        upload = await imageKit.files.upload({
            file: await toFile(file.buffer, file.originalname || "avatar", { type: file.mimetype || "image/jpeg" }),
            fileName: `avatar-${randomUUID()}`,
            folder: "/avatars",
            useUniqueFileName: true,
        });
    } catch {
        throw new ApiError(502, "The profile photo could not be uploaded. Please try again.");
    }

    if (!upload.fileId || !upload.url) {
        throw new ApiError(502, "The profile photo could not be uploaded.");
    }

    const body: ApiResponse<{ url: string; fileId: string }> = {
        success: true,
        message: "Profile photo uploaded.",
        data: {
            url: upload.url,
            fileId: upload.fileId,
        },
    };

    response.status(200).json(body);
});
