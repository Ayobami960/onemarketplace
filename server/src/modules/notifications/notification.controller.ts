import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import type { ApiResponse } from "../../types/common.types.js";
import { getNotification, readAllNotifications, readNotification } from "./notification.service.js";
import { addNotificationClient } from "./notification.sse.js";

export const listNotification: RequestHandler = asyncHandler(async (request, response) => {
    const data = await getNotification(request.auth!.userId);
    response.json({
        success: true,
        message: "Notifications retrieved.",
        data,
    } satisfies ApiResponse<typeof data>);
});

export const markAllNotificationsRead: RequestHandler = asyncHandler(async (request, response) => {
    await readAllNotifications(request.auth!.userId);
    response.json({
        success: true,
        message: "Notifications marked as read.",
    } satisfies ApiResponse<never>);
});

export const markNotificationRead: RequestHandler = asyncHandler(async (request, response) => {
    const found = await readNotification(request.auth!.userId, String(request.params.id));
    if (!found) throw new ApiError(404, "Notification not found.");

    response.json({
        success: true,
        message: "Notification marked as read.",
    } satisfies ApiResponse<never>);
});

export const notificationStream: RequestHandler = (request, response) => {
    response.status(200).set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });

    response.flushHeaders();
    response.write("event: connected\ndata: {}\n\n");

    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25_000);
    const removeClient = addNotificationClient(request.auth!.userId, response);

    request.on("close", () => {
        clearInterval(heartbeat);
        removeClient();
    });
};