import { Router } from "express";
import { createProposal, getProposalMetadata, getProposals } from "./proposals.controller.js";
import { authenticate, requireOnboarded } from "../../middleware/auth.middleware.js";

export const proposalRouter = Router();
proposalRouter.use(authenticate, requireOnboarded);
proposalRouter.get("/",  getProposals);
proposalRouter.get("/metadata",  getProposalMetadata);
proposalRouter.post("/",  createProposal);


