import {Router} from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import { getLoggedInClientProfile, upsertClientProfile } from "./client.controller.js";

export const clientRouter = Router();
clientRouter.use(authenticate, requireRole("client"));
clientRouter.get("/profile", getLoggedInClientProfile);
clientRouter.put("/profile", upsertClientProfile);
