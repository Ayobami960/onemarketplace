import {Router} from "express";
import { authenticate, requireOnboarded } from "../../middleware/auth.middleware.js";
import { createClientJobPost, editClientJobPost, getClientJobPost, getFreelancerSavedJobPosts, removeClientJobPost, saveFreelancerJobPost, unsaveFreelancerJobPost } from "./jobs.controller.js";

export const jobRouter = Router();
jobRouter.use(authenticate, requireOnboarded);
jobRouter.post("/", createClientJobPost);
jobRouter.get("/", getClientJobPost);
jobRouter.get("/saved", getFreelancerSavedJobPosts);
jobRouter.post("/saved/:jobId", saveFreelancerJobPost);
jobRouter.delete("/saved/:jobId",  unsaveFreelancerJobPost);
jobRouter.get("/:jobId", getClientJobPost);
jobRouter.put("/:jobId", editClientJobPost);
jobRouter.delete("/:jobId", removeClientJobPost);


// jobRouter.post("/", isAuthenticated, createClientJobPost);
// jobRouter.get("/", isAuthenticated, getClientJobPosts);
// jobRouter.get("/public", getPublicJobFeedHandler);
// jobRouter.get("/saved", isAuthenticated, getFreelancerSavedJobPosts);
// jobRouter.post("/saved/:jobId", isAuthenticated, saveFreelancerJobPost);
// jobRouter.delete("/saved/:jobId", isAuthenticated, unsaveFreelancerJobPost);
// jobRouter.get("/:jobId", isAuthenticated, getClientJobPosts);
// jobRouter.put("/:jobId", isAuthenticated, editClientJobPost);
// jobRouter.delete("/:jobId", isAuthenticated, removeClientJobPost);
