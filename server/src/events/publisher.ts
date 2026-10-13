import { JSONCodec } from "nats";
import { NOTIFICATIONS_SUBJECT, type NotificationEvent } from "./subjects.js";
import { getNats } from "../config/nats.js";
import { randomUUID } from "crypto";



const codec = JSONCodec<NotificationEvent>();


export const sendNotification = async (input: Omit<NotificationEvent, "eventId" | "createdAt">,) => {
    const nats = await getNats();
    const event = {
        ...input,
        eventId: randomUUID(),
        createdAt: new Date().toDateString(),
    };

    await nats.jetstream().publish(NOTIFICATIONS_SUBJECT, codec.encode(event));
    return event;
}