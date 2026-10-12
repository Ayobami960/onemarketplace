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
