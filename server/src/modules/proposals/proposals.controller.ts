import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import { requireText } from "../../config/constants.js";
import { ApiError } from "../../utils/api-error.js";
import { getFreelancerProposalMetadata, getFreelancerProposals, submitProposal } from "./proposals.service.js";


export const createProposal: RequestHandler = asyncHandler(
    async (request, response) => {
        const auth = requireFreelancer(request);
        const coverLetter = requireText(request.body?.coverLetter, "Cover letter");
        const bidAmount = Number(request.body?.bidAmount);
        const screeningAnswers = Array.isArray(request.body?.screeningAnswers)
            ? request.body.screeningAnswers.map((answer: unknown) =>
                typeof answer === "string" ? answer.trim() : "",
            )
            : [];
        if (coverLetter.length < 80) throw new ApiError(400, "Cover letter must be at least 80 characters.");

        if (
            !Number.isFinite(bidAmount) ||
            bidAmount <= 0 ||
            bidAmount > 1_000_000
        ) {
            throw new ApiError(400, "Enter a valid bid amount.");
        }

        const result = await submitProposal(auth.userId, {
            jobId: requireText(request.body?.jobId, "Job post"),
            coverLetter,
            bidAmount,
            duration: requireText(request.body?.duration, "Delivery duration"),
            screeningAnswers,
        });

        response.status(201).json({ success: true, message: "Proposal submitted.", data: result })
    },

);

export const getProposalMetadata: RequestHandler = asyncHandler(
    async(request, response) => {
        const auth = requireFreelancer(request);
        const metadata = await getFreelancerProposalMetadata(auth.userId);
        response.status(200).json({
            success: true,
            message: "Proposal metadata retrieved.",
            data: metadata,
        });
    },
);


// export const getProposals: RequestHandler = asyncHandler(
//   async (request, response) => {
//     if (!request.auth) throw new ApiError(401, "Authentication is required.");
//     const proposals =
//       request.auth.role === "client"
//         ? await getClientJobProposals(
//             request.auth.userId,
//             requireText(request.query.jobId as any, "Job post"),
//           )
//         : await getFreelancerProposals(request.auth.userId);
//     response.status(200).json({
//       success: true,
//       message: "Proposals retrieved.",
//       data: proposals,
//     });
//   },
// );


export const getProposals: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireFreelancer(request);
    const proposals = await getFreelancerProposals(auth.userId);
    response.status(200).json({
      success: true,
      message: "Proposals retrieved.",
      data: proposals,
    });
  },
);


