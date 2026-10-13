import { isNetworkError } from "@/app/utils/client-api";

export type AuthFailureKind = "unauthenticated" | "offline" | "server_error";

/** Dispatched on window when a data request fails because of the network. */
export const CONNECTION_ISSUE_EVENT = "app:connection-issue";

const isAbort = (cause: unknown): boolean =>
    cause instanceof DOMException &&
    (cause.name === "AbortError" || cause.name === "TimeoutError");

/**
 * Pass a non-ok Response or a thrown error from the guard's own `auth/me` /
 * `auth/refresh` calls. Only 401/403 means the session is invalid; everything
 * else is a connection problem and must never redirect to login.
 */
export function classifyAuthFailure(input: unknown): AuthFailureKind {
    if (input instanceof Response) {
        return input.status === 401 || input.status === 403 ? "unauthenticated" : "server_error";
    }
    if (isNetworkError(input) || isAbort(input)) return "offline";
    return "server_error";
}