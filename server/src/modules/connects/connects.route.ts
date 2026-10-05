import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import { getConnectsBalanceHandler, getConnectsHistoryHandler } from "./connects.controller.js";

export const connectsRouter = Router();
connectsRouter.use(authenticate, requireRole("freelancer"));
connectsRouter.get("/balance", getConnectsBalanceHandler);
connectsRouter.get("/history", getConnectsHistoryHandler);
