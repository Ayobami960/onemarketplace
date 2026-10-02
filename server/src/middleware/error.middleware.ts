import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";
import type { ApiResponse } from "../types/common.types.js";

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next
) => {
    const statusCode = error instanceof ApiError ? error?.statusCode : 500;
    if (!(error instanceof ApiError)) {
        console.error("UNHANDLED_API_ERROR", {
            error,
        });
    }

    const message = error instanceof ApiError
        ? error.message
        : "An unexpected server error occurred.";

    response.status(statusCode).json({
        success: false,
        message,
    } satisfies ApiResponse<never>)
};