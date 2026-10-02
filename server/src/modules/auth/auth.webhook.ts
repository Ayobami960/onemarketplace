import { verifyWebhook } from "@clerk/backend/webhooks";
import { Router, type NextFunction, type Request, type Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { getVerifiedEmail, receiveSignup } from "./auth.service.js";
import { createClerkClient, type User } from "@clerk/backend";
import { env } from "../../config/env.js";

const WEBHOOK_SECRET = env.clerkWebhookSigningSecret;

export const clerkWebhookRouter = Router();

/**
 * Returns true when Clerk considers at least one of the user's email
 * addresses verified, using the same rule as receiveSignup.
 */
function isEmailVerified(user: User): boolean {
  const addresses = user.emailAddresses;
  if (!Array.isArray(addresses)) {
    return false;
  }
  return addresses.some((addr) => addr.verification?.status === "verified");
}

/**
 * POST /api/v1/auth/webhooks/clerk
 *
 * Reconciles Clerk account state with the local accounts table.
 *
 * This endpoint is the background complement to the synchronous
 * POST /api/v1/auth/sign-up path that the landing page hits right
 * after Clerk finalize. If that synchronous request is lost (weak
 * network, timeout, 5xx), this webhook is what reliably creates the
 * local DB row once Clerk confirms the email is verified.
 *
 * It only creates a row when ALL of the following are true:
 *   1. The webhook signature is valid.
 *   2. The event is user.created or user.updated.
 *   3. The Clerk user's email is verified.
 *   4. The user has a signup role of "client" or "freelancer" in
 *      unsafeMetadata.
 *
 * Double delivery is harmless: receiveSignup is idempotent on auth_id
 * via onConflictDoNothing.
 */
clerkWebhookRouter.post(
  "/",
  asyncHandler(async (request: Request, response: Response, next: NextFunction) => {
    if (!WEBHOOK_SECRET) {
      console.error("CLERK_WEBHOOK_SIGNING_SECRET is not configured; rejecting webhook.");
      throw new ApiError(
        500,
        "Webhook signing secret is not configured.",
      );
    }

    // @clerk/backend/webhooks.verifyWebhook expects a standard Web API
    // Request whose headers are a HeadersInit. Build a Headers object from
    // the Express IncomingHttpHeaders, then construct a Web API Request.
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) {
        headers.append(key, String(value));
      }
    }

    const webRequest = new Request(request.originalUrl, {
      method: request.method,
      headers,
      body: request.rawBody?.toString("utf8"),
    });

    let event;
    try {
      event = await verifyWebhook(webRequest, {
        signingSecret: WEBHOOK_SECRET,
      });
    } catch (error) {
      console.error("Clerk webhook signature verification failed.", error);
      throw new ApiError(400, "Webhook signature verification failed.");
    }

    const eventType = event.type;
    if (eventType !== "user.created" && eventType !== "user.updated") {
      // Acknowledge so Clerk stops retrying, but do nothing.
      response.status(200).json({
        success: true,
        message: `Unhandled event type ${eventType}.`,
      });
      return;
    }

    const userId = event.data.id as string;
    if (!userId) {
      response.status(200).json({
        success: true,
        message: "Event payload missing user id; nothing to do.",
      });
      return;
    }

    const clerk = createClerkClient({ secretKey: env.clerkSecretKey });
    const user = await clerk.users.getUser(userId);

    const rawRole =
      user.unsafeMetadata?.role ??
      user.unsafeMetadata?.signupRole ??
      undefined;

    const role: "client" | "freelancer" | undefined =
      rawRole === "client" || rawRole === "freelancer" ? rawRole : undefined;

    if (!role) {
      // Not a OneMarketplace signup we care about, or role not yet recorded.
      response.status(200).json({
        success: true,
        message: `User ${userId} has no recognizable signup role; nothing to do.`,
      });
      return;
    }

    // Webhooks can fire before email verification completes. Only
    // create the local record when email is verified.
    const emailVerified = isEmailVerified(user);

    if (!emailVerified) {
      response.status(200).json({
        success: true,
        message: `User ${userId} email is not yet verified; will reconcile later.`,
      });
      return;
    }

    const email = getVerifiedEmail(user);

    if (!email) {
      response.status(200).json({
        success: true,
        message: `User ${userId} has no email; nothing to do.`,
      });
      return;
    }

    await receiveSignup({
      userId,
      sessionId: undefined,
      role,
      accountExists: false,
      isOnboarded: false,
    });

    response.status(200).json({
      success: true,
      message: `Reconciled user ${userId} for role ${role}.`,
    });
  }),
);
