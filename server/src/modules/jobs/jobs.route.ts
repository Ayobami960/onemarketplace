import {Router} from "express";
import { isAuthenticated, requireOnboarded } from "../../middleware/auth.middleware.js";
import { createClientJobPost, editClientJobPost, getClientJobPost, removeClientJobPost } from "./jobs.controller.js";

export const jobRouter = Router();
jobRouter.use(isAuthenticated, requireOnboarded);
jobRouter.post("/", createClientJobPost);
jobRouter.get("/", getClientJobPost);
jobRouter.get("/:jobId", getClientJobPost);
jobRouter.put("/:jobId", editClientJobPost);
jobRouter.delete("/:jobId", removeClientJobPost);



