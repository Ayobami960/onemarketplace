


import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

interface MeResponse {
    success: boolean;
    data?: {
        role: "client" | "freelancer";
        accountExists: boolean;
        isOnboarded: boolean;
    };
}

const redirectToHomePage = () =>
    NextResponse.redirect(
        new URL(
            "/login",
            process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE || "http://localhost:3000",
        ),
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
        return redirectToHomePage();
    }

    try {
        const token = await getToken();

        if (!token) {
            return redirectToHomePage();
        }

        const meResponse = await fetch(new URL("/api/me", request.url), {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!meResponse.ok) {
            return redirectToHomePage();
        }

        const account = (await meResponse.json()) as MeResponse;

        if (!account.success || !account.data?.accountExists || account.data.role !== "freelancer") {
            return redirectToHomePage();
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
        console.error("Freelancer account status check failed.", error);
        return redirectToHomePage();
    }
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    ],
};
