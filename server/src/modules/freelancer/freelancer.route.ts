import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import { getFreelancerJobDetails, getFreelancerJobFeed, getLoggedInFreelancerProfileHandler, upsertFreelanceProfile } from "./freelancer.controller.js";

export const freelancerRouter = Router();
freelancerRouter.use(authenticate, requireRole("freelancer"));
freelancerRouter.get("/profile", getLoggedInFreelancerProfileHandler);
freelancerRouter.put("/profile", upsertFreelanceProfile);
freelancerRouter.get("/jobs", getFreelancerJobFeed);
freelancerRouter.get("/jobs/:id", getFreelancerJobDetails);



