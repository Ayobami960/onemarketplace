interface AccountResponse {
    success: boolean;
    message: string;
    data?: {
        role: "client" | "freelancer";
        isOnboardingComplete: boolean;
    };
}

export async function GET(request: Request) {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");
    if (!serverUrl) return Response.json({ success: false, message: "The authentication service is not configured." }, { status: 500 });
    try {
        const backendResponse = await fetch(`${serverUrl}/api/v1/auth/me`, {
            headers: { cookie: request.headers.get("cookie") ?? "" },
            cache: "no-store",
        });
        const account = await backendResponse.json() as AccountResponse;
        if (!backendResponse.ok || !account.data) {
            return Response.json(account, { status: backendResponse.status });
        }
        if (account.data.role !== "freelancer") {
            return Response.json({ success: false, message: "A freelancer account is required." }, { status: 403 });
        }
        return Response.json({
            success: true,
            message: "Account status retrieved.",
            data: {
                role: account.data.role,
                accountExists: true,
                isOnboarded: account.data.isOnboardingComplete,
            },
        });
    } catch {
        return Response.json({ success: false, message: "The authentication service is unavailable." }, { status: 502 });
    }
}
