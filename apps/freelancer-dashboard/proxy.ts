import { NextResponse, type NextRequest } from "next/server";

interface AccountResponse {
    success: boolean;
    data?: {
        role: "client" | "freelancer";
        emailVerified: boolean;
        isOnboardingComplete: boolean;
    };
}

const getServerUrl = (): string | undefined =>
    process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");

const redirectToLanding = (path = "/login"): NextResponse => {
    const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE || "http://localhost:3000";
    return NextResponse.redirect(new URL(path, landingPage));
};

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
        if (separator > 0) {
            cookieValues.set(pair!.slice(0, separator), pair!.slice(separator + 1));
        }
    }
    return [...cookieValues].map(([name, value]) => `${name}=${value}`).join("; ");
};

const withRotatedCookies = (response: NextResponse, cookies: string[]): NextResponse => {
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
    return response;
};

export default async function proxy(request: NextRequest) {
    const serverUrl = getServerUrl();
    if (!serverUrl) return redirectToLanding("/error?reason=auth_unavailable");

    const incomingCookies = request.headers.get("cookie") ?? "";
    let cookiesForApi = incomingCookies;
    let rotatedCookies: string[] = [];

    try {
        let meResponse = await fetch(`${serverUrl}/api/v1/auth/me`, {
            headers: { cookie: cookiesForApi },
            cache: "no-store",
        });

        if (meResponse.status === 401) {
            const refreshResponse = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
                method: "POST",
                headers: {
                    cookie: incomingCookies,
                    origin: request.nextUrl.origin,
                },
                cache: "no-store",
            });
            if (!refreshResponse.ok) return redirectToLanding();

            rotatedCookies = refreshResponse.headers.getSetCookie();
            if (rotatedCookies.length === 0) return redirectToLanding();
            cookiesForApi = mergeCookies(incomingCookies, rotatedCookies);
            meResponse = await fetch(`${serverUrl}/api/v1/auth/me`, {
                headers: { cookie: cookiesForApi },
                cache: "no-store",
            });
        }

        if (meResponse.status === 401 || meResponse.status === 403) return redirectToLanding();
        if (!meResponse.ok) return redirectToLanding("/error?reason=auth_unavailable");
        const account = await meResponse.json() as AccountResponse;
        if (!account.success || !account.data || !account.data.emailVerified) return redirectToLanding();

        if (account.data.role !== "freelancer") {
            const destination = account.data.role === "client"
                ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
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
        return redirectToLanding("/error?reason=auth_unavailable");
    }
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
    ],
};
