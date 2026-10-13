import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { listNotification, markAllNotificationsRead, notificationStream } from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get("/", listNotification);
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.get("/stream", notificationStream);
