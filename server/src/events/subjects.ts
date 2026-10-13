export const NOTIFICATIONS_STREAM = "NOTIFICATIONS";
export const NOTIFICATIONS_SUBJECT = "notifications.created";
export const NOTIFICATIONS_CONSUMER = "notifications-storage";

export interface NotificationEvent {
    eventId: string;
    recipientId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}