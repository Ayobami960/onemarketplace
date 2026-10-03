
import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface MeResponse {
    success: boolean;
    data?: {
        role: "client" | "freelancer";
        accountExists: boolean;
        isOnboarded: boolean;
    };
}

const redirectToLogin = (request: NextRequest) =>
    NextResponse.redirect(
        new URL("/login", process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE ?? request.nextUrl.origin),
    );

export default clerkMiddleware(async (auth, request) => {
    if (request.nextUrl.pathname === "/api/me") {
        return NextResponse.next();
    }

    if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    const { userId, getToken } = await auth();

    if (!userId) {
        return redirectToLogin(request);
    }

    try {
        // A page navigation never carries an Authorization header, and a
        // relayed session cookie isn't a valid credential once it crosses
        // to a different origin (the Express backend). Mint a fresh Clerk
        // session token here instead of forwarding request headers as-is.
        const token = await getToken();

        if (!token) {
            return redirectToLogin(request);
        }

        const meResponse = await fetch(new URL("/api/me", request.url), {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!meResponse.ok) {
            return redirectToLogin(request);
        }

        const account = (await meResponse.json()) as MeResponse;

        if (!account.success || !account.data?.accountExists || account.data.role !== "client") {
            return redirectToLogin(request);
        }

        const isEditingProfile = request.nextUrl.pathname === "/profile/edit";

        if (!account.data.isOnboarded) {
            if (isEditingProfile) {
                return NextResponse.next();
            }

            return NextResponse.redirect(new URL("/profile/edit", request.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error("Client account status check failed.", error);
        return redirectToLogin(request);
    }
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    ],
};