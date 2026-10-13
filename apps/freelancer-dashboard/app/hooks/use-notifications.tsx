"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "timeago.js";
import { useClientAccount } from "../provider";
import { clientApiFetch } from "@/app/utils/api";
import type {
    DashboardNotification,
    NotificationCategory,
} from "../_components/notifications/types";

const BASE_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;
const STALE_MS = 30_000;

// Use "client" in the client dashboard.
const ROLE = "freelancer";

type ApiResponse<T> = { success: boolean; message?: string; data?: T };

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type AppNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
};

// Accepts snake_case or camelCase, whichever the server sends.
type RawNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    is_read?: boolean;
    isRead?: boolean;
    created_at?: string;
    createdAt?: string;
};

export const normalizeNotification = (raw: RawNotification): AppNotification => ({
    id: raw.id,
    type: raw.type,
    title: raw.title,
    message: raw.message,
    link: raw.link ?? null,
    is_read: raw.is_read ?? raw.isRead ?? false,
    created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
});

const byNewest = (a: AppNotification, b: AppNotification) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

/* -------------------------------------------------------------------------- */
/*                               Presentation                                 */
/* -------------------------------------------------------------------------- */

const categoryFor = (type: string): NotificationCategory => {
    const value = type.toLowerCase();
    if (value.includes("payment")) return "Payments";
    if (value.includes("message")) return "Messages";
    if (value.includes("proposal") || value.includes("interview")) return "Proposals";
    if (value.includes("contract") || value.includes("milestone")) return "Contracts";
    return "Account";
};

const icons: Record<NotificationCategory, string> = {
    Contracts: "solar:check-circle-linear",
    Proposals: "solar:document-text-linear",
    Messages: "solar:chat-round-dots-linear",
    Payments: "solar:wallet-money-linear",
    Account: "solar:bell-linear",
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const presentNotification = (notification: AppNotification): DashboardNotification => {
    const category = categoryFor(notification.type);
    const createdAt = new Date(notification.created_at);
    const valid = !Number.isNaN(createdAt.getTime());

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    return {
        id: notification.id,
        icon: icons[category],
        title: notification.title,
        description: notification.message,
        category,
        href: notification.link || "/notifications",
        unread: !notification.is_read,
        time: valid ? format(createdAt) : "",
        date: !valid
            ? "Earlier"
            : sameDay(createdAt, today)
              ? "Today"
              : sameDay(createdAt, yesterday)
                ? "Yesterday"
                : "Earlier",
    };
};

/* -------------------------------------------------------------------------- */
/*                              List + mutations                              */
/* -------------------------------------------------------------------------- */

export const useNotifications = () => {
    const account = useClientAccount();
    const queryClient = useQueryClient();
    const queryKey = ["notifications", account.id];

    const query = useQuery<AppNotification[]>({
        queryKey,
        enabled: Boolean(account.id),
        staleTime: STALE_MS,
        queryFn: async () => {
            const response = await clientApiFetch(`notifications?role=${ROLE}`);
            const result = (await response.json().catch(() => null)) as
                ApiResponse<RawNotification[]> | null;

            if (!response.ok || !result?.success) {
                throw new Error(result?.message ?? "Notifications could not be loaded.");
            }
            return (result.data ?? []).map(normalizeNotification).sort(byNewest);
        },
    });

    // No id = mark every notification as read.
    const updateRead = (id?: string) =>
        queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
            current.map((item) =>
                !id || item.id === id ? { ...item, is_read: true } : item,
            ),
        );

    const requestRead = async (path: string) => {
        const response = await clientApiFetch(`notifications/${path}?role=${ROLE}`, {
            method: "PATCH",
        });
        if (!response.ok) {
            const result = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
            throw new Error(result?.message ?? "Notification could not be updated.");
        }
    };

    const markRead = useMutation({
        mutationFn: (id: string) => requestRead(`${id}/read`),
        onSuccess: (_data, id) => updateRead(id),
    });

    const markAllRead = useMutation({
        mutationFn: () => requestRead("read-all"),
        onSuccess: () => updateRead(),
    });

    const notifications = query.data ?? [];

    return {
        notifications,
        unreadCount: notifications.filter((item) => !item.is_read).length,
        isLoading: query.isLoading,
        error: query.error,
        markRead: markRead.mutate,
        markAllRead: markAllRead.mutate,
    };
};

/* -------------------------------------------------------------------------- */
/*                 Live updates (mounted ONCE, in the header)                 */
/* -------------------------------------------------------------------------- */

export const useNotificationStream = () => {
    const account = useClientAccount();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!account.id) return;

        const queryKey = ["notifications", account.id];
        const controller = new AbortController();
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;

        const handleFrame = (frame: string) => {
            let eventName = "message";
            const dataLines: string[] = [];

            for (const line of frame.split("\n")) {
                if (line.startsWith("event:")) eventName = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
                // lines starting with ":" are heartbeats/comments; ignore them
            }

            if (eventName !== "notification" || !dataLines.length) return;

            try {
                const notification = normalizeNotification(
                    JSON.parse(dataLines.join("\n")) as RawNotification,
                );
                queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) => [
                    notification,
                    ...current.filter((item) => item.id !== notification.id),
                ]);
            } catch (error) {
                console.error("Invalid notification payload.", error);
            }
        };

        const scheduleRetry = () => {
            if (controller.signal.aborted) return;
            const delay = Math.min(BASE_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
            attempt += 1;
            retryTimer = setTimeout(() => void connect(), delay);
        };

        const connect = async () => {
            try {
                const response = await clientApiFetch(`notifications/stream?role=${ROLE}`, {
                    signal: controller.signal,
                    headers: { Accept: "text/event-stream" },
                });

                if (!response.ok || !response.body) {
                    throw new Error("SSE unavailable");
                }

                attempt = 0; // connected: reset backoff

                // Catch anything that arrived while the stream was down.
                void queryClient.invalidateQueries({ queryKey });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let pending = "";

                while (!controller.signal.aborted) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

                    const frames = pending.split("\n\n");
                    pending = frames.pop() ?? ""; // keep the incomplete tail
                    frames.forEach(handleFrame);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.warn("Notification stream disconnected.", error);
            }

            // Reached on errors AND on a clean close by the server/proxy.
            scheduleRetry();
        };

        void connect();

        return () => {
            controller.abort();
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [account.id, queryClient]);
};