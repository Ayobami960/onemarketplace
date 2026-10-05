import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { authenticateAccessToken, getCookieNames } from "../modules/auth/auth.service.js";

const readCookie = (header: string | undefined, name: string): string | undefined => {
    if (!header) return undefined;
    const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
};

const readAccessToken = (request: Parameters<RequestHandler>[0]): string | undefined => {
    const cookieToken = readCookie(request.headers.cookie, getCookieNames().access);
    if (cookieToken) return cookieToken;
    const authorization = request.get("authorization");
    return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() || undefined : undefined;
};

export const authenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
    const token = readAccessToken(request);
    if (!token) throw new ApiError(401, "Authentication is required.");
    request.auth = await authenticateAccessToken(token);
    next();
});

export const isAuthenticated = authenticate;

export const requireRole = (...roles: Array<"client" | "freelancer">): RequestHandler => (request, _response, next) => {
    if (!request.auth) {
        next(new ApiError(401, "Authentication is required."));
        return;
    }
    if (!roles.includes(request.auth.role)) {
        next(new ApiError(403, "This account does not have permission to access this resource."));
        return;
    }
    next();
};