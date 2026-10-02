
import { createClerkClient, verifyToken } from "@clerk/nextjs/server";
import {NextRequest, NextResponse} from "next/server";

const roles = ["client", "freelancer"] as const;

type SignupRole = (typeof roles)[number];

function dashboardUrlFor(role: SignupRole): string | undefined {
    return role === "client"
        ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
        : process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD;
}

function redirectToError(
    request: NextRequest,
    reason: string,
    role?: SignupRole,
){
    const errorUrl = new URL("/error", request.url);
    errorUrl.searchParams.set("reason", reason);
    if (role) {
        errorUrl.searchParams.set("role", role);
    }
    return NextResponse.redirect(errorUrl);
}

function isSignupRole(value: string | null):value is SignupRole{
return roles.some((role) => role === value);
}

function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError ||
        (error instanceof Error &&
            (error.message.includes("fetch failed") ||
                error.message.includes("ETIMEDOUT") ||
                error.message.includes("ECONNREFUSED")));
}

export async function GET(request: NextRequest){
    const token = request.nextUrl.searchParams.get("token");
    const role = request.nextUrl.searchParams.get("role");
    const secretKey = process.env.CLERK_SECRET_KEY;
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
    const backendUrl = serverUrl?.replace(/\/+$/, "").replace(/\/api\/v1$/, "");

    if(!token || !role){
        return redirectToError(request, "missing_signup_details")
    }

    if(!isSignupRole(role)){
        return redirectToError(request, "invalid_role")
    }

    if(!secretKey){
        console.error("CLERK_SECRET_KEY is not configured.");
        return redirectToError(request, "authentication_unavailable")
    }

    if(!backendUrl){
        console.error("NEXT_PUBLIC_SERVER_URL is not configured.");
        return redirectToError(request, "backend_signup_failed", role)
    }

    let claims;

    // verify token in the clerk server
    try {
        claims = await verifyToken(token, {
            secretKey,
        });

        const clerk = createClerkClient({secretKey});
        const user = await clerk.users.getUser(claims.sub)

        // The token belongs to a Clerk user, but the role in the URL must
        // match what we recorded in Clerk unsafeMetadata at signup time.
        const recordedRole =
            user.unsafeMetadata?.role ??
            user.unsafeMetadata?.signupRole ??
            undefined;

        if(recordedRole !== role){
            return redirectToError(request, "role_mismatch")
        }
    } catch (error) {
        console.error("Clerk signup verification failed.", error);
        if (isNetworkError(error)) {
            return redirectToError(request, "authentication_unavailable")
        }
        return redirectToError(request, "invalid_or_expired_token")
    }

    try {
        const signupResponse = await fetch(
            `${backendUrl}/api/v1/auth/sign-up`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ role }),
                cache: "no-store",
            }
        );

        if(!signupResponse.ok){
            console.error(
                `Backend signup failed with status ${signupResponse.status}.`,
            );
            return redirectToError(request, "backend_signup_failed", role)
        }

        const dashboardUrl = dashboardUrlFor(role);

        if(!dashboardUrl){
            console.error(
                `Dashboard URL is not configured for ${role} signup.`,
            );
            return redirectToError(request, "dashboard_unavailable", role)
        }

        return NextResponse.redirect(
            new URL("/profile/edit", dashboardUrl),
            303,
        )
    } catch (error) {
        console.error("Backend signup forwarding failed.", error);
        return redirectToError(request, "backend_unreachable", role);
    }
}
