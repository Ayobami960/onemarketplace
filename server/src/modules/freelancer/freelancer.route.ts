import {Router} from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { getLoggedInFreelancerProfileHandler, upsertFreelanceProfile } from "./freelancer.controller.js";

export const freelancerRouter = Router();
freelancerRouter.get("/profile", isAuthenticated, getLoggedInFreelancerProfileHandler);
freelancerRouter.put("/profile", isAuthenticated, upsertFreelanceProfile);

