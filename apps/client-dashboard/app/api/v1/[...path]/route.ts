import type { NextRequest } from "next/server";

/**
 * Same-origin proxy for the API. The browser only ever talks to this app, so the
 * session cookies the API sets stay first-party here. That is what removes the
 * need for a shared `COOKIE_DOMAIN` when the apps live on separate Vercel
 * domains. `x-forwarded-for` is forwarded so the API's per-IP rate limiters
 * still see the real client address.
 */
const serverUrl = (): string => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");
    if (!url) throw new Error("NEXT_PUBLIC_SERVER_URL is not configured.");
    return url;
};

const forwardedHeaders = (request: NextRequest): Headers => {
    const headers = new Headers();
    for (const name of ["content-type", "accept", "authorization", "cookie", "origin", "referer", "user-agent"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    return headers;
};

// Host-only cookies keep the session on this app's domain; a stray Domain from
// a shared-domain deployment must not leak onto a different origin.
const withoutDomain = (cookie: string): string =>
    cookie.split(";").filter((part) => !part.trim().toLowerCase().startsWith("domain=")).join(";");

const proxy = async (request: NextRequest, path: string[]): Promise<Response> => {
    let target: string;
    try {
        target = `${serverUrl()}/api/v1/${path.join("/")}${new URL(request.url).search}`;
    } catch (error) {
        return Response.json(
            { success: false, message: error instanceof Error ? error.message : "The API is not configured." },
            { status: 500 },
        );
    }

    const method = request.method.toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method,
            headers: forwardedHeaders(request),
            body: body && body.byteLength > 0 ? body : undefined,
            cache: "no-store",
            redirect: "manual",
        });
    } catch {
        return Response.json(
            { success: false, message: "The server is unavailable. Please try again." },
            { status: 502 },
        );
    }

    const headers = new Headers();
    upstream.headers.forEach((value, name) => {
        const key = name.toLowerCase();
        if (["set-cookie", "content-encoding", "content-length", "transfer-encoding"].includes(key)) return;
        headers.set(name, value);
    });
    for (const cookie of upstream.headers.getSetCookie()) {
        headers.append("set-cookie", withoutDomain(cookie));
    }

    return new Response(upstream.body, { status: upstream.status, headers });
};

type RouteContext = { params: Promise<{ path: string[] }> };

const handler = (request: NextRequest, context: RouteContext) =>
    context.params.then(({ path }) => proxy(request, path));

export const dynamic = "force-dynamic";
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
