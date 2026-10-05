import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import { createFreelancerProposal, listFreelancerProposals, withdrawFreelancerProposalHandler } from "./proposals.controller.js";

export const proposalsRouter = Router();
proposalsRouter.use(authenticate, requireRole("freelancer"));
proposalsRouter.get("/", listFreelancerProposals);
proposalsRouter.post("/", createFreelancerProposal);
proposalsRouter.post("/:proposalId/withdraw", withdrawFreelancerProposalHandler);