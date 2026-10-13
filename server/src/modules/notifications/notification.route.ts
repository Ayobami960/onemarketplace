import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
    listNotification,
    markAllNotificationsRead,
    markNotificationRead,
    notificationStream,
} from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get("/", listNotification);
notificationRouter.get("/stream", notificationStream);
// "read-all" must be registered before "/:id/read".
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:id/read", markNotificationRead);