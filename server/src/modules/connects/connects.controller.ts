import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import type { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { PROPOSAL_CONNECTS } from "../../config/constants.js";
import { getConnectsBalance, getConnectsHistory } from "./connects.service.js";

const getFreelancerId = (request: Parameters<RequestHandler>[0]): string => {
	if (!request.auth) throw new ApiError(401, "Authentication is required.");
	if (request.auth.role !== "freelancer") throw new ApiError(403, "A freelancer account is required.");
	return request.auth.userId;
};

export const getConnectsBalanceHandler: RequestHandler = asyncHandler(async (request, response) => {
	const balance = await getConnectsBalance(getFreelancerId(request));
	const data = { balance, proposalCost: PROPOSAL_CONNECTS };
	response.status(200).json({ success: true, message: "Connects balance retrieved.", data } satisfies ApiResponse<typeof data>);
});

export const getConnectsHistoryHandler: RequestHandler = asyncHandler(async (request, response) => {
	const history = await getConnectsHistory(getFreelancerId(request));
	response.status(200).json({ success: true, message: "Connects history retrieved.", data: history } satisfies ApiResponse<typeof history>);
});
