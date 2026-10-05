import { Router } from "express";
import multer from "multer";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { uploadAvatar } from "./upload.controller.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            callback(new Error("Choose a JPG, PNG, or WebP image."));
            return;
        }

        callback(null, true);
    },
});

export const uploadRouter = Router();
uploadRouter.post("/avatar", isAuthenticated, (request, response, next) => {
    upload.single("avatar")(request, response, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            next(new ApiError(413, "Profile photos must be 5 MB or smaller."));
            return;
        }

        next(new ApiError(400, "Choose a JPG, PNG, or WebP image."));
    });
}, uploadAvatar);
