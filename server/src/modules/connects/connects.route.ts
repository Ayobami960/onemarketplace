import { Router } from "express";
import { authenticate, } from "../../middleware/auth.middleware.js";
import { availableConnects } from "../../middleware/connects.middleware.js";
import { buyConnects, connectsWebhook, getAvailableConnects, getLoggedInFreelancerConnectsHistory } from "./connects.controller.js";

export const connectsRouter = Router();

connectsRouter.post("/webhook", connectsWebhook);
connectsRouter.use(authenticate, availableConnects);
connectsRouter.get("/", getAvailableConnects);
connectsRouter.get("/history", getLoggedInFreelancerConnectsHistory);
connectsRouter.post("/checkout", buyConnects);

