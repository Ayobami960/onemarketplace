export const clientApiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");
    if (!serverUrl) throw new Error("NEXT_PUBLIC_SERVER_URL is not configured.");

    const apiPath = path.replace(/^\/+/, "");
    return fetch(`${serverUrl}/api/v1/${apiPath}`, {
        ...init,
        credentials: "include",
        cache: init.cache ?? "no-store",
    });
};