import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The browser never talks to the API directly: each frontend proxies
 * `/api/v1/*` through its own origin, so these cookies are first-party to the
 * app that holds them. That works on separate Vercel domains without a shared
 * `COOKIE_DOMAIN`. These tests pin those cookie attributes without touching a
 * database.
 */
const requiredEnv: Record<string, string> = {
    DATABASE_URL: "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder",
    JWT_ACCESS_SECRET: "production-jwt-secret-with-at-least-32-chars",
    OTP_HMAC_SECRET: "production-otp-secret-with-at-least-32-chars",
    ORIGINS_CLIENT_LANDING_PAGE: "https://www.example.com",
    ORIGINS_CLIENT_DASHBOARD: "https://client.example.com",
};

const loadCookieOptions = async (nodeEnv: "production" | "development") => {
    vi.resetModules();
    for (const [key, value] of Object.entries(requiredEnv)) process.env[key] = value;
    process.env.NODE_ENV = nodeEnv;
    const { sessionCookieOptions } = await import("./auth.controller.js");
    return sessionCookieOptions;
};

afterEach(() => {
    vi.resetModules();
    delete process.env.NODE_ENV;
});

describe("session cookie attributes", () => {
    it("uses first-party, secure settings in production", async () => {
        const options = await loadCookieOptions("production");
        const cookie = options(900);

        expect(cookie.sameSite).toBe("lax");
        expect(cookie.secure).toBe(true);
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.path).toBe("/");
        expect(cookie.maxAge).toBe(900_000);
    }, 30_000);

    it("keeps a lax, non-secure cookie for local development", async () => {
        const options = await loadCookieOptions("development");
        const cookie = options(60);

        expect(cookie.sameSite).toBe("lax");
        expect(cookie.secure).toBe(false);
    }, 30_000);
});
