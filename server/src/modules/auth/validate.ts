import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../../utils/api-error.js";

export const validate = (schema: ZodType): RequestHandler => (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
        next(new ApiError(400, "Request validation failed."));
        return;
    }
    request.body = result.data;
    next();
};