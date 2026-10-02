import {Router} from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { createClientJobPost, editClientJobPost, getClientJobPost, removeClientJobPost } from "./jobs.controller.js";

export const jobRouter = Router();
jobRouter.post("/", isAuthenticated, createClientJobPost);
jobRouter.get("/", isAuthenticated, getClientJobPost);
jobRouter.get("/:jobId", isAuthenticated, getClientJobPost);
jobRouter.put("/:jobId", isAuthenticated, editClientJobPost);
jobRouter.delete("/:jobId", isAuthenticated, removeClientJobPost);



