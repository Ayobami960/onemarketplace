
import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import type { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { completeConnectPurchase, createConnectsCheckout, getConnectsBalance, getConnectsHistory, reconcileUncreditedPurchases, type ConnectsReconcileResult } from "./connects.service.js";

import { CONNECTS_PLANS, type ConnectsPlan } from '../../config/constants.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import type Stripe from "stripe";

export const getAvailableConnects: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);

    const body: ApiResponse<{ connects: number }> = {
        success: true,
        message: "Available Connects retrieved",
        data: { connects: request.availableConnects ?? 0 },
    };

    response.status(200).json(body);
});

export const getLoggedInFreelancerConnectsHistory: RequestHandler = asyncHandler(async(request, response) => {
    const auth = requireFreelancer(request);
    const history = await getConnectsHistory(auth.userId);

    const body: ApiResponse<typeof history> = {
        success: true,
        message: "Connects history retrieved.",
        data: history
    };

    response.status(200).json(body);
})


export const buyConnects: RequestHandler = asyncHandler(async(request, response) => {
        const auth = requireFreelancer(request);
        const purchasedConnects = Number(request.body?.connects) as ConnectsPlan;

        if(!(purchasedConnects in CONNECTS_PLANS)){
            throw new ApiError(400, "Select a valid Connects package.");
        }

        const url = await createConnectsCheckout(auth.userId, purchasedConnects);
        response.status(200).json({
            success: true,
            message: "Stripe Checkout created.",
            data: {url},
        } satisfies ApiResponse<{ url: string}>);
})



export const connectsWebhook: RequestHandler = asyncHandler(async (request, response) => {
    const signature = request.headers["stripe-signature"];

    if(!env.stripeWebhookKey || typeof signature !== "string") {
        console.error("Stripe webhook rejected: missing secret or signature header.", {
            hasWebhookSecret: Boolean(env.stripeWebhookKey),
            hasSignature: typeof signature === "string",
        });
        throw new ApiError(400, "Invalid Stripe webhook.");
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(request.body, signature, env.stripeWebhookKey);
    } catch (cause) {
        console.error("Stripe webhook signature verification failed.", {
            message: cause instanceof Error ? cause.message : cause,
        });
        throw new ApiError(400, "Invalid Stripe webhook signature.");
    }

    if(event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const freelancerId = session.metadata?.freelancerId;
        const purchasedConnects = Number(session.metadata?.purchasedConnects) as ConnectsPlan;

        if(
            session.payment_status === "paid" &&
            freelancerId &&
            purchasedConnects in CONNECTS_PLANS
        ) {
            await completeConnectPurchase(
                freelancerId,
                purchasedConnects,
                session.id,
            );
        }}
        response.status(200).json({received: true});
});

/**
 * Credits a paid Checkout Session that the webhook has not processed yet.
 * Stripe redirects the buyer here with the session id, so a missed or
 * misconfigured webhook no longer leaves a paid purchase uncredited. The
 * credit itself stays idempotent because the session id is the payment id.
 */
export const confirmConnectsPurchase: RequestHandler = asyncHandler(async(request, response) => {
    const auth = requireFreelancer(request);
    const sessionId = typeof request.body?.sessionId === "string" ? request.body.sessionId.trim() : "";

    if (!sessionId) {
        throw new ApiError(400, "A checkout session id is required.");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.freelancerId !== auth.userId) {
        throw new ApiError(403, "This checkout session does not belong to your account.");
    }

    const purchasedConnects = Number(session.metadata?.purchasedConnects) as ConnectsPlan;

    if (session.payment_status !== "paid" || !(purchasedConnects in CONNECTS_PLANS)) {
        throw new ApiError(409, "This checkout has not been paid yet.");
    }

    const creditedBalance = await completeConnectPurchase(auth.userId, purchasedConnects, session.id);

    const body: ApiResponse<{ connects: number }> = {
        success: true,
        message: "Connects purchase confirmed.",
        data: { connects: creditedBalance ?? (await getConnectsBalance(auth.userId)) },
    };

    response.status(200).json(body);
});

const timingSafeStringEqual = (provided: string, expected: string): boolean => {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    // timingSafeEqual throws on a length mismatch, so compare lengths first.
    if (providedBuffer.length !== expectedBuffer.length) return false;

    return timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
 * Reads the shared secret from either supported transport:
 *   - `x-reconcile-secret: <secret>` for manual or external schedulers,
 *   - `Authorization: Bearer <secret>` because that is all Vercel Cron sends.
 */
const readReconcileSecret = (request: Request): string | undefined => {
    const header = request.headers["x-reconcile-secret"];

    if (typeof header === "string" && header.trim().length > 0) {
        return header.trim();
    }

    const authorization = request.headers.authorization;

    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
        return authorization.slice("Bearer ".length).trim() || undefined;
    }

    return undefined;
};

/**
 * Runs the Connects reconciliation safety net on demand, for hosts without a
 * long-running process (Vercel Cron, for example). Disabled until one of the
 * accepted secrets is configured, and then only for a matching caller.
 *
 * Registered for both GET and POST: Vercel Cron always issues a GET.
 */
export const reconcileConnectsPurchases: RequestHandler = asyncHandler(async(request, response) => {
    const secrets = env.connectsReconcileSecrets;

    if (secrets.length === 0) {
        throw new ApiError(404, "Route not found.");
    }

    const provided = readReconcileSecret(request);

    if (!provided || !secrets.some((secret) => timingSafeStringEqual(provided, secret))) {
        throw new ApiError(401, "Authentication is required.");
    }

    const result = await reconcileUncreditedPurchases();

    const body: ApiResponse<ConnectsReconcileResult> = {
        success: true,
        message: "Connects reconciliation finished.",
        data: result,
    };

    response.status(200).json(body);
});






// const getFreelancerId = (request: Parameters<RequestHandler>[0]): string => {
// 	if (!request.auth) throw new ApiError(401, "Authentication is required.");
// 	if (request.auth.role !== "freelancer") throw new ApiError(403, "A freelancer account is required.");
// 	return request.auth.userId;
// };

// export const getConnectsBalanceHandler: RequestHandler = asyncHandler(async (request, response) => {
// 	const balance = await getConnectsBalance(getFreelancerId(request));
// 	const data = { balance, proposalCost: PROPOSAL_CONNECTS };
// 	response.status(200).json({ success: true, message: "Connects balance retrieved.", data } satisfies ApiResponse<typeof data>);
// });

// export const getConnectsHistoryHandler: RequestHandler = asyncHandler(async (request, response) => {
// 	const history = await getConnectsHistory(getFreelancerId(request));
// 	response.status(200).json({ success: true, message: "Connects history retrieved.", data: history } satisfies ApiResponse<typeof history>);
// });


