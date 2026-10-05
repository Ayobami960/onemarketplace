import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authLimiter, otpLimiter } from "./auth-limiter.js";
import {
    forgotPassword, login, logout, me, refresh, register, resendOtp, resetPassword, updateMe, verifyEmail,
} from "./auth.controller.js";
import {
    forgotPasswordSchema, loginSchema, registerSchema, resendOtpSchema, resetPasswordSchema, updateAccountProfileSchema, verifyEmailSchema,
} from "./auth.schemas.js";
import { validate } from "./validate.js";
import { assertSafeOrigin } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate(registerSchema), register);
authRouter.post("/login", authLimiter, validate(loginSchema), login);
authRouter.post("/logout", assertSafeOrigin, logout);
authRouter.post("/refresh", assertSafeOrigin, refresh);
authRouter.post("/forgot-password", authLimiter, otpLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post("/reset-password", authLimiter, otpLimiter, validate(resetPasswordSchema), resetPassword);
authRouter.post("/verify-email", authLimiter, otpLimiter, validate(verifyEmailSchema), verifyEmail);
authRouter.post("/resend-otp", authLimiter, otpLimiter, validate(resendOtpSchema), resendOtp);
authRouter.get("/me", authenticate, me);
authRouter.put("/me", authenticate, validate(updateAccountProfileSchema), updateMe);