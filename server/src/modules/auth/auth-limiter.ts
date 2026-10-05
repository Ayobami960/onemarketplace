import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many authentication requests. Try again later." },
});

export const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => {
        const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown";
        const emailKey = createHash("sha256").update(email).digest("hex");
        return `${ipKeyGenerator(request.ip ?? "unknown")}:${emailKey}`;
    },
    message: { success: false, message: "Too many code requests. Try again later." },
});