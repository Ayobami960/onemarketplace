import { NextResponse } from "next/server";

/**
 * Finishes the sign-in hand-off from the landing page. The one-time code is
 * exchanged server-to-server and the API's session cookies are re-issued on this
 * app's own origin, so the dashboard keeps a first-party session without a
 * shared `COOKIE_DOMAIN`.
 */
const serverUrl = (): string | undefined =>
    process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");

const withoutDomain = (cookie: string): string =>
    cookie.split(";").filter((part) => !part.trim().toLowerCase().startsWith("domain=")).join(";");

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code") ?? "";
    const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE;
    const loginUrl = new URL("/login", landingPage ?? requestUrl.origin);
    const server = serverUrl();

    if (!server || !code) {
        return NextResponse.redirect(loginUrl);
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${server}/api/v1/auth/handoff/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
            cache: "no-store",
        });
    } catch {
        return NextResponse.redirect(loginUrl);
    }

    if (!upstream.ok) {
        return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.set("Referrer-Policy", "no-referrer");
    for (const cookie of upstream.headers.getSetCookie()) {
        response.headers.append("set-cookie", withoutDomain(cookie));
    }
    return response;
}

export const dynamic = "force-dynamic";
