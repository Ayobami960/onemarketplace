import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import { getLoggedInFreelancerProfileHandler, upsertFreelanceProfile } from "./freelancer.controller.js";

export const freelancerRouter = Router();
freelancerRouter.use(authenticate, requireRole("freelancer"));
freelancerRouter.get("/profile", getLoggedInFreelancerProfileHandler);
freelancerRouter.put("/profile", upsertFreelanceProfile);

