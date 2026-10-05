import { z } from "zod";
import type { RequestHandler } from "express";
import { PROPOSAL_CONNECTS } from "../../config/constants.js";
import { ApiError } from "../../utils/api-error.js";
import type { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getFreelancerProposals, submitFreelancerProposal, withdrawFreelancerProposal } from "./proposals.service.js";

const proposalInputSchema = z.object({
    jobId: z.string().uuid(),
    bidAmount: z.coerce.number().finite().min(1).max(1_000_000),
    deliveryTime: z.enum(["Less than 1 month", "1–2 months", "3–6 months", "More than 6 months"]),
    coverLetter: z.string().trim().min(80).max(10_000),
});

const requireFreelancer = (request: Parameters<RequestHandler>[0]): string => {
    if (!request.auth) throw new ApiError(401, "Authentication is required.");
    if (request.auth.role !== "freelancer") throw new ApiError(403, "A freelancer account is required.");
    if (!request.auth.isOnboarded) throw new ApiError(403, "Complete your freelancer profile before submitting proposals.");
    return request.auth.userId;
};

export const listFreelancerProposals: RequestHandler = asyncHandler(async (request, response) => {
    const proposals = await getFreelancerProposals(requireFreelancer(request));
    response.status(200).json({ success: true, message: "Proposals retrieved.", data: proposals } satisfies ApiResponse<typeof proposals>);
});

export const createFreelancerProposal: RequestHandler = asyncHandler(async (request, response) => {
    const freelancerId = requireFreelancer(request);
    const parsed = proposalInputSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Proposal details are invalid.");

    const result = await submitFreelancerProposal(freelancerId, parsed.data);
    const data = { proposal: result.proposal, balance: result.balance.connects, proposalCost: PROPOSAL_CONNECTS };
    response.status(201).json({ success: true, message: "Proposal submitted.", data } satisfies ApiResponse<typeof data>);
});

export const withdrawFreelancerProposalHandler: RequestHandler = asyncHandler(async (request, response) => {
    const freelancerId = requireFreelancer(request);
    const parsedId = z.string().uuid().safeParse(request.params.proposalId);
    if (!parsedId.success) throw new ApiError(400, "Proposal id is invalid.");

    const result = await withdrawFreelancerProposal(freelancerId, parsedId.data);
    const data = { proposal: result.proposal, balance: result.balance.connects };
    response.status(200).json({ success: true, message: "Proposal withdrawn and Connects refunded.", data } satisfies ApiResponse<typeof data>);
});