/**
 * All browser API calls go through this app's own `/api/v1` proxy so the session
 * cookies stay first-party. That works on separate Vercel domains without a
 * shared `COOKIE_DOMAIN`.
 */
export const clientApiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
    const apiPath = path.replace(/^\/+/, "");
    return fetch(`/api/v1/${apiPath}`, {
        ...init,
        credentials: "include",
        cache: init.cache ?? "no-store",
    });
};

/**
 * `fetch` rejects with a TypeError when the request never reached the server,
 * and the browser reports offline while the connection is unavailable. Both are
 * worth a "check your connection and try again" message rather than the raw
 * failure, because retrying once the network is back is enough.
 */
export const isNetworkError = (cause: unknown): boolean => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    return cause instanceof TypeError;
};
