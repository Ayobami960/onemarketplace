import type { RequestHandler } from "express";
import type { CookieOptions } from "express";
import { ApiError } from "../../utils/api-error.js";
import type { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { env } from "../../config/env.js";
import {
    forgotPassword as sendPasswordReset, getCookieNames, getMe, getTokenTtls,
    login as authenticateAccount, refresh as rotateRefreshToken, register as createAccount,
    resendOtp as sendVerificationCode, resetPassword as updatePassword,
    revokeSession, revokeByRefreshToken, updateAccountProfile, verifyEmail as verifyAccountEmail,
    createHandoffCode, exchangeHandoffCode,
    type AuthRequestContext, type IssuedTokens,
} from "./auth.service.js";

/**
 * The browser never calls the API directly: each frontend proxies `/api/v1/*`
 * through its own origin, so these cookies are always first-party to the app
 * that holds them. That keeps them working on separate Vercel domains without a
 * shared `COOKIE_DOMAIN`, and lets us keep the safer `Lax` policy. `Secure` is
 * still required on HTTPS.
 */
const sameSiteForEnvironment = (): CookieOptions["sameSite"] => "lax";

export const sessionCookieOptions = (maxAge: number): CookieOptions => ({
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: sameSiteForEnvironment(),
    path: "/",
    maxAge: maxAge * 1000,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
});

const requestContext = (request: Parameters<RequestHandler>[0]): AuthRequestContext => {
    const userAgent = request.get("user-agent");
    return {
        ...(request.ip ? { ip: request.ip } : {}),
        ...(userAgent ? { userAgent } : {}),
    };
};

const setTokenCookies = (response: Parameters<RequestHandler>[1], tokens: IssuedTokens): void => {
    const names = getCookieNames();
    const ttl = getTokenTtls();
    response.cookie(names.access, tokens.accessToken, sessionCookieOptions(ttl.access));
    response.cookie(names.refresh, tokens.refreshToken, sessionCookieOptions(ttl.refresh));
};

const clearTokenCookies = (response: Parameters<RequestHandler>[1]): void => {
    const names = getCookieNames();
    response.clearCookie(names.access, sessionCookieOptions(0));
    response.clearCookie(names.refresh, sessionCookieOptions(0));
};

const readCookie = (header: string | undefined, name: string): string | undefined => {
    const item = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
};

const assertSafeOrigin: RequestHandler = (request, _response, next) => {
    const origin = request.get("origin");
    if (origin && !env.allowedOrigins.includes(origin)) {
        next(new ApiError(403, "Request origin is not allowed."));
        return;
    }
    next();
};

export const register: RequestHandler = asyncHandler(async (request, response) => {
    const result = await createAccount(request.body);
    response.status(202).json({ success: true, message: result.message } satisfies ApiResponse<never>);
});

export const login: RequestHandler = asyncHandler(async (request, response) => {
    const result = await authenticateAccount(request.body, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({ success: true, message: "Signed in.", data: result.account } satisfies ApiResponse<typeof result.account>);
});

export const verifyEmail: RequestHandler = asyncHandler(async (request, response) => {
    const result = await verifyAccountEmail(request.body, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({ success: true, message: "Email verified.", data: result.account } satisfies ApiResponse<typeof result.account>);
});

export const resendOtp: RequestHandler = asyncHandler(async (request, response) => {
    await sendVerificationCode(request.body.email);
    response.status(200).json({ success: true, message: "If the address requires verification, a code will be sent." } satisfies ApiResponse<never>);
});

export const refresh: RequestHandler = asyncHandler(async (request, response) => {
    const token = readCookie(request.headers.cookie, getCookieNames().refresh);
    if (!token) throw new ApiError(401, "Refresh token is invalid or expired.");
    const tokens = await rotateRefreshToken(token, requestContext(request));
    setTokenCookies(response, tokens);
    response.status(200).json({ success: true, message: "Session refreshed." } satisfies ApiResponse<never>);
});

export const logout: RequestHandler = asyncHandler(async (request, response) => {
    const refreshToken = readCookie(request.headers.cookie, getCookieNames().refresh);
    const sessionId = request.auth?.sessionId;
    await revokeSession(sessionId);
    if (refreshToken) await revokeByRefreshToken(refreshToken);
    clearTokenCookies(response);
    response.status(200).json({ success: true, message: "Signed out." } satisfies ApiResponse<never>);
});

export const forgotPassword: RequestHandler = asyncHandler(async (request, response) => {
    await sendPasswordReset(request.body.email);
    response.status(200).json({ success: true, message: "If an account exists, password reset instructions will be sent." } satisfies ApiResponse<never>);
});

export const resetPassword: RequestHandler = asyncHandler(async (request, response) => {
    await updatePassword(request.body);
    clearTokenCookies(response);
    response.status(200).json({ success: true, message: "Password reset. Please sign in again." } satisfies ApiResponse<never>);
});

export const handoff: RequestHandler = asyncHandler(async (request, response) => {
    if (!request.auth?.sessionId) throw new ApiError(401, "Authentication is required.");
    const result = await createHandoffCode(request.auth.userId, request.auth.sessionId);
    response.status(200).json({ success: true, message: "Sign-in hand-off created.", data: result } satisfies ApiResponse<typeof result>);
});

export const exchangeHandoff: RequestHandler = asyncHandler(async (request, response) => {
    const result = await exchangeHandoffCode(request.body.code, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({ success: true, message: "Signed in.", data: result.account } satisfies ApiResponse<typeof result.account>);
});

export const me: RequestHandler = asyncHandler(async (request, response) => {
    if (!request.auth) throw new ApiError(401, "Authentication is required.");
    const account = await getMe(request.auth.userId);
    response.status(200).json({ success: true, message: "Account retrieved.", data: account } satisfies ApiResponse<typeof account>);
});

export const updateMe: RequestHandler = asyncHandler(async (request, response) => {
    if (!request.auth) throw new ApiError(401, "Authentication is required.");
    const account = await updateAccountProfile(request.auth.userId, request.body);
    response.status(200).json({ success: true, message: "Account profile updated.", data: account } satisfies ApiResponse<typeof account>);
});

export { assertSafeOrigin };