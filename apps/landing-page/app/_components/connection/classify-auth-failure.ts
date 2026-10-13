import { isNetworkError } from "@/app/_components/auth-api";

export type AuthFailureKind = "unauthenticated" | "offline" | "server_error";

const isAbort = (cause: unknown): boolean =>
    cause instanceof DOMException &&
    (cause.name === "AbortError" || cause.name === "TimeoutError");

/**
 * Pass a non-ok Response or a thrown error from `auth/me`. Only 401/403 means
 * the session is invalid. Everything else is a connection problem.
 */
export function classifyAuthFailure(input: unknown): AuthFailureKind {
    if (input instanceof Response) {
        return input.status === 401 || input.status === 403 ? "unauthenticated" : "server_error";
    }
    if (isNetworkError(input) || isAbort(input)) return "offline";
    return "server_error";
}