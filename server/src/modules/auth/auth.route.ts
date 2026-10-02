import {Router} from "express";
import { isAuthenticated, isSignupAuthenticated } from "../../middleware/auth.middleware.js";
import { getAuthStatus, signup } from "./auth.controller.js";

export const authRouter = Router();
authRouter.post("/sign-up", isSignupAuthenticated, signup);
authRouter.get("/status", isAuthenticated, getAuthStatus);
