import { NextResponse, type NextRequest } from "next/server";

interface AccountResponse {
    success: boolean;
    data?: {
        role: "client" | "freelancer";
        emailVerified: boolean;
        isOnboardingComplete: boolean;
    };
}

// A hung API (e.g. hotspot without internet) must not block the page load.
const API_TIMEOUT_MS = 5_000;

const getServerUrl = (): string | undefined =>
    process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");

const hasSessionCookies = (header: string): boolean =>
    /(?:^|;\s*)om_(?:access|refresh)=/.test(header);

const redirectToLanding = (path = "/login"): NextResponse => {
    const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE || "http://localhost:3000";
    return NextResponse.redirect(new URL(path, landingPage));
};

const apiFetch = (url: string, init: RequestInit = {}): Promise<Response> =>
    fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

const mergeCookies = (currentCookies: string, setCookies: string[]): string => {
    const cookieValues = new Map<string, string>();
    for (const cookie of currentCookies.split(";")) {
        const separator = cookie.indexOf("=");
        if (separator > 0) {
            cookieValues.set(cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim());
        }
    }
    for (const cookie of setCookies) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair?.indexOf("=") ?? -1;
        if (pair && separator > 0) {
            cookieValues.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
    }
    return [...cookieValues].map(([name, value]) => `${name}=${value}`).join("; ");
};

const withRotatedCookies = (response: NextResponse, cookies: string[]): NextResponse => {
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
    return response;
};

const isSessionInvalid = (status: number): boolean => status === 401 || status === 403;

export default async function proxy(request: NextRequest) {
    const serverUrl = getServerUrl();
    // Misconfiguration or no session cookies on this origin: let the client-side
    // guard decide. It shows the connection screen instead of bouncing to login.
    if (!serverUrl) return NextResponse.next();

    const incomingCookies = request.headers.get("cookie") ?? "";
    if (!hasSessionCookies(incomingCookies)) return NextResponse.next();

    let cookiesForApi = incomingCookies;
    let rotatedCookies: string[] = [];

    try {
        let meResponse = await apiFetch(`${serverUrl}/api/v1/auth/me`, {
            headers: { cookie: cookiesForApi },
        });

        if (meResponse.status === 401) {
            const refreshResponse = await apiFetch(`${serverUrl}/api/v1/auth/refresh`, {
                method: "POST",
                headers: { cookie: incomingCookies, origin: request.nextUrl.origin },
            });

            // Only an explicit rejection means the session is gone.
            if (isSessionInvalid(refreshResponse.status)) return redirectToLanding();
            // 5xx or anything else: the API is in trouble, not the user's session.
            if (!refreshResponse.ok) return NextResponse.next();

            rotatedCookies = refreshResponse.headers.getSetCookie();
            if (rotatedCookies.length === 0) return redirectToLanding();

            cookiesForApi = mergeCookies(incomingCookies, rotatedCookies);
            meResponse = await apiFetch(`${serverUrl}/api/v1/auth/me`, {
                headers: { cookie: cookiesForApi },
            });
        }

        if (isSessionInvalid(meResponse.status)) return redirectToLanding();

        // Keep rotated cookies even when deferring, or the new refresh token is lost.
        if (!meResponse.ok) return withRotatedCookies(NextResponse.next(), rotatedCookies);

        const account = (await meResponse.json()) as AccountResponse;
        if (!account.success || !account.data) {
            return withRotatedCookies(NextResponse.next(), rotatedCookies);
        }

        if (!account.data.emailVerified) {
            return withRotatedCookies(
                redirectToLanding("/login?reason=email_not_verified"),
                rotatedCookies,
            );
        }

        if (account.data.role !== "client") {
            const destination =
                account.data.role === "freelancer"
                    ? process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD
                    : undefined;
            return withRotatedCookies(
                destination
                    ? NextResponse.redirect(new URL(destination))
                    : redirectToLanding("/error?reason=wrong_role"),
                rotatedCookies,
            );
        }

        const isEditingProfile = request.nextUrl.pathname === "/profile/edit";
        if (!account.data.isOnboardingComplete && !isEditingProfile) {
            return withRotatedCookies(
                NextResponse.redirect(new URL("/profile/edit", request.url)),
                rotatedCookies,
            );
        }

        return withRotatedCookies(NextResponse.next(), rotatedCookies);
    } catch {
        // Network error, timeout, or unparsable body: not a logout.
        return withRotatedCookies(NextResponse.next(), rotatedCookies);
    }
}

export const config = {
    matcher: [
        "/((?!api|session|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
    ],
};