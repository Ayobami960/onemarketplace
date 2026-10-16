import { Router } from "express";
import { authenticate, requireOnboarded } from "../../middleware/auth.middleware.js";
import { availableConnects } from "../../middleware/connects.middleware.js";
import { buyConnects, confirmConnectsPurchase, connectsWebhook, getAvailableConnects, getLoggedInFreelancerConnectsHistory, reconcileConnectsPurchases } from "./connects.controller.js";

export const connectsRouter = Router();
connectsRouter.use(authenticate, requireOnboarded, availableConnects);

/*
 * Stripe must reach these before the auth middleware below: an unknown path
 * under /connects falls through to `authenticate` and is rejected with a 401,
 * which silently drops every delivery. Both spellings are served because the
 * Stripe CLI command documented in Read.md forwards to /connects/webhooks.
 */
connectsRouter.post("/webhook", connectsWebhook);
connectsRouter.post("/webhooks", connectsWebhook);
/*
 * Serverless cron entry point, guarded by a shared secret. Both methods are
 * registered because Vercel Cron issues a GET while manual and external
 * schedulers typically POST.
 */
connectsRouter.get("/reconcile", reconcileConnectsPurchases);
connectsRouter.post("/reconcile", reconcileConnectsPurchases);
connectsRouter.get("/", getAvailableConnects);
connectsRouter.get("/history", getLoggedInFreelancerConnectsHistory);
connectsRouter.post("/checkout", buyConnects);
connectsRouter.post("/confirm", confirmConnectsPurchase);

