
import type { RequestHandler } from "express";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import type { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { completeConnectPurchase, createConnectsCheckout, getConnectsHistory } from "./connects.service.js";
import { CONNECTS_PLANS, type ConnectsPlan } from '../../config/constants.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import type Stripe from "stripe";

export const getAvailableConnects: RequestHandler = (request, response) => {
    requireFreelancer(request);


    const body: ApiResponse<{connects: number}> = {
        success: true,
        message: "Available  Connects retrieved",
        data: {connects: request.availableConnects ?? 0},
    };

    response.status(200).json(body);
};

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
          request.logger.error({
            message: "Webhook secret is missing",
            importance: "critical",
            service: "connects-controller",
          });
        throw new ApiError(400, "Invalid Stripe webhook.");
    }

    const event = stripe.webhooks.constructEvent(request.body, signature, env.stripeWebhookKey);

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


