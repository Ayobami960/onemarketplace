import { JSONCodec } from "nats";
import { randomUUID } from "node:crypto";
import { NOTIFICATIONS_SUBJECT, type NotificationEvent } from "./subjects.js";
import { getNats } from "../config/nats.js";

const codec = JSONCodec<NotificationEvent>();

export const sendNotification = async (
    input: Omit<NotificationEvent, "eventId" | "createdAt">,
): Promise<NotificationEvent> => {
    const nats = await getNats();
    const event: NotificationEvent = {
        ...input,
        eventId: randomUUID(),
        createdAt: new Date().toISOString(),
    };

    // msgID lets JetStream drop duplicates if a publish is retried.
    await nats.jetstream().publish(NOTIFICATIONS_SUBJECT, codec.encode(event), {
        msgID: event.eventId,
    });
    return event;
};