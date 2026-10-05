import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const mailerMock = vi.hoisted(() => ({
    sent: [] as Array<{ to: string; text: string }>,
    failNextSend: false,
    sendEmail: vi.fn(async (_message: { to: string; text: string }) => undefined),
}));

vi.mock("./mailer.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./mailer.js")>();
    return {
        ...actual,
        verifyMailer: vi.fn(async () => undefined),
        sendEmail: mailerMock.sendEmail,
    };
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!testDatabaseUrl);
const trackedEmails: string[] = [];
let app: (typeof import("../../server.js"))["app"];
let db: (typeof import("../../database/clients.js"))["db"];
let pool: (typeof import("../../database/clients.js"))["pool"];
let accounts: (typeof import("../../database/schema.js"))["accounts"];
let verificationCodes: (typeof import("../../database/schema.js"))["verification_codes"];
const newEmail = (): string => {
    const email = `auth-test-${randomUUID()}@example.test`;
    trackedEmails.push(email);
    return email;
};

const latestOtp = (email: string): string => {
    for (const payload of mailerMock.sent.toReversed()) {
        if (payload.to !== email) continue;
        const match = /code is (\d{6})/.exec(payload.text);
        if (match) return match[1]!;
    }
    throw new Error(`No development OTP was captured for ${email}.`);
};

const cookieValue = (response: supertest.Response, cookieName: string): string => {
    const header = response.headers["set-cookie"] as string | string[] | undefined;
    const cookies = Array.isArray(header) ? header : header ? [header] : [];
    const cookie = cookies.find((value) => value.startsWith(`${cookieName}=`));
    if (!cookie) throw new Error(`Expected ${cookieName} cookie.`);
    return cookie.split(";", 1)[0]!;
};

suite("first-party auth API", () => {
    beforeAll(async () => {
        process.env.DATABASE_URL = testDatabaseUrl;
        process.env.REDIS_HOST = "";
        process.env.VERCEL = "1";
        process.env.NODE_ENV = "test";
        process.env.JWT_ACCESS_SECRET = "integration-test-jwt-secret-with-32-chars";
        process.env.OTP_HMAC_SECRET = "integration-test-otp-secret-with-32-chars";
        const server = await import("../../server.js");
        const database = await import("../../database/clients.js");
        const schema = await import("../../database/schema.js");
        app = server.app;
        db = database.db;
        pool = database.pool;
        accounts = schema.accounts;
        verificationCodes = schema.verification_codes;
        app.set("trust proxy", true);
    });

    beforeEach(() => {
        mailerMock.sent.length = 0;
        mailerMock.failNextSend = false;
        mailerMock.sendEmail.mockImplementation(async (message) => {
            if (mailerMock.failNextSend) {
                mailerMock.failNextSend = false;
                throw new Error("Email delivery failed: test SMTP failure");
            }
            mailerMock.sent.push(message);
        });
    });

    afterAll(async () => {
        if (db) {
            if (trackedEmails.length) await db.delete(accounts).where(inArray(accounts.email, trackedEmails));
        }
        if (pool) await pool.end();
    });

    it("registers, verifies, logs in, reads /me, rotates refresh, detects reuse, and logs out", async () => {
        const email = newEmail();
        const agent = supertest.agent(app);
        await agent.post("/api/v1/auth/register").send({ firstName: "Riley", lastName: "Tester", country: "US", email: ` ${email.toUpperCase()} `, password: "CedarSky!2026", role: "client" }).expect(202);
        const [registeredAccount] = await db.select({ firstName: accounts.first_name, lastName: accounts.last_name, country: accounts.country })
            .from(accounts).where(eq(accounts.email, email));
        expect(registeredAccount).toEqual({ firstName: "Riley", lastName: "Tester", country: "US" });
        const verify = await agent.post("/api/v1/auth/verify-email").send({ email, code: latestOtp(email) }).expect(200);
        expect(verify.body.data.emailVerified).toBe(true);
        expect(verify.body.data.firstName).toBe("Riley");
        expect(verify.body.data.lastName).toBe("Tester");
        expect(verify.headers["set-cookie"]).toBeDefined();

        await agent.get("/api/v1/auth/me").expect(200);
        const login = await agent.post("/api/v1/auth/login").send({ email, password: "CedarSky!2026" }).expect(200);
        const oldRefreshCookie = cookieValue(login, "om_refresh");
        const accessCookie = cookieValue(login, "om_access");
        await agent.get("/api/v1/auth/me").expect(200);
        const updatedProfile = await agent.put("/api/v1/auth/me")
            .send({ firstName: "Riley Updated", lastName: "Tester" })
            .expect(200);
        expect(updatedProfile.body.data.firstName).toBe("Riley Updated");

        await agent.post("/api/v1/auth/refresh").expect(200);
        await supertest(app).post("/api/v1/auth/refresh").set("Cookie", oldRefreshCookie).expect(401);
        await agent.post("/api/v1/auth/logout").expect(200);
        await supertest(app).get("/api/v1/auth/me").set("Cookie", accessCookie).expect(401);
    });

    it("rejects unverified login and invalidates OTPs after five failures", async () => {
        const unverifiedEmail = newEmail();
        await supertest(app).post("/api/v1/auth/register").send({ firstName: "Alex", lastName: "Freelancer", country: "CA", email: unverifiedEmail, password: "CedarSky!2026", role: "freelancer" }).expect(202);
        await supertest(app).post("/api/v1/auth/login").send({ email: unverifiedEmail, password: "CedarSky!2026" }).expect(403);

        const email = newEmail();
        await supertest(app).post("/api/v1/auth/register").send({ firstName: "Casey", lastName: "Client", country: "GB", email, password: "CedarSky!2026", role: "client" }).expect(202);
        const correctCode = latestOtp(email);
        for (let attempt = 0; attempt < 5; attempt++) {
            await supertest(app).post("/api/v1/auth/verify-email").send({ email, code: "000000" === correctCode ? "000001" : "000000" }).expect(400);
        }
        await supertest(app).post("/api/v1/auth/verify-email").send({ email, code: correctCode }).expect(400);
    });

    it("returns 502 when verification email delivery fails", async () => {
        const email = newEmail();
        mailerMock.failNextSend = true;
        const response = await supertest(app).post("/api/v1/auth/register")
            .send({ firstName: "Morgan", lastName: "Tester", country: "US", email, password: "CedarSky!2026", role: "client" })
            .expect(502);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("We could not send the verification code. Please try again.");
    });

    it("returns 502 when password reset code delivery fails", async () => {
        const email = newEmail();
        await supertest(app).post("/api/v1/auth/register")
            .send({ firstName: "Morgan", lastName: "Tester", country: "US", email, password: "CedarSky!2026", role: "client" })
            .expect(202);
        await supertest(app).post("/api/v1/auth/verify-email")
            .send({ email, code: latestOtp(email) })
            .expect(200);

        mailerMock.failNextSend = true;
        const response = await supertest(app).post("/api/v1/auth/forgot-password").send({ email }).expect(502);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("We could not send the password reset code. Please try again.");
    });

    it("rejects expired codes and resets the password while revoking all sessions", async () => {
        const email = newEmail();
        const agent = supertest.agent(app);
        await agent.post("/api/v1/auth/register").send({ firstName: "Taylor", lastName: "Freelancer", country: "AU", email, password: "CedarSky!2026", role: "freelancer" }).expect(202);
        const verificationCode = latestOtp(email);
        await agent.post("/api/v1/auth/verify-email").send({ email, code: verificationCode }).expect(200);
        const login = await agent.post("/api/v1/auth/login").send({ email, password: "CedarSky!2026" }).expect(200);
        const accessCookie = cookieValue(login, "om_access");

        await supertest(app).post("/api/v1/auth/forgot-password").send({ email }).expect(200);
        const resetCode = latestOtp(email);
        const [account] = await db.select({ authId: accounts.auth_id }).from(accounts).where(eq(accounts.email, email));
        if (!account) throw new Error("Test account was not created.");
        await db.update(verificationCodes).set({ expires_at: new Date(Date.now() - 1000) })
            .where(and(eq(verificationCodes.account_id, account.authId), eq(verificationCodes.purpose, "password_reset")));
        await supertest(app).post("/api/v1/auth/reset-password").send({ email, code: resetCode, password: "NewCedarSky!2026" }).expect(400);
        await db.update(verificationCodes).set({ consumed_at: new Date() })
            .where(and(eq(verificationCodes.account_id, account.authId), eq(verificationCodes.purpose, "password_reset")));

        await supertest(app).post("/api/v1/auth/forgot-password").send({ email }).expect(200);
        const freshResetCode = latestOtp(email);
        await supertest(app).post("/api/v1/auth/reset-password").send({ email, code: freshResetCode, password: "NewCedarSky!2026" }).expect(200);
        await supertest(app).get("/api/v1/auth/me").set("Cookie", accessCookie).expect(401);
        await supertest(app).post("/api/v1/auth/login").send({ email, password: "NewCedarSky!2026" }).expect(200);
    });

    it("applies the auth IP rate limit", async () => {
        const agent = supertest(app);
        let finalResponse: supertest.Response | undefined;
        for (let attempt = 0; attempt < 31; attempt++) {
            finalResponse = await agent.post("/api/v1/auth/register")
                .set("X-Forwarded-For", "203.0.113.241")
                .send({ email: "invalid", password: "short", role: "client" });
        }
        expect(finalResponse?.status).toBe(429);
    });
});