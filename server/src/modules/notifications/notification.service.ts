import { and, desc, eq } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { notifications } from "../../database/schema.js";

export const getNotification = (userId: string) =>
    db
        .select()
        .from(notifications)
        .where(eq(notifications.recipient_id, userId))
        .orderBy(desc(notifications.created_at)) // use the exact property name from schema.ts
        .limit(50);

export const readAllNotifications = async (userId: string): Promise<void> => {
    await db
        .update(notifications)
        .set({ is_read: true, read_at: new Date() })
        .where(eq(notifications.recipient_id, userId));
};

/** Returns false when the notification doesn't exist or belongs to someone else. */
export const readNotification = async (userId: string, id: string): Promise<boolean> => {
    const updated = await db
        .update(notifications)
        .set({ is_read: true, read_at: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.recipient_id, userId)))
        .returning({ id: notifications.id });

    return updated.length > 0;
};