import { auth } from "@clerk/nextjs/server";

interface BackendAuthStatusResponse {
    success: boolean;
    message: string;
    data?: {
        role: "client" | "freelancer";
        accountExists: boolean;
        isOnboarded: boolean;
    };
}

export async function GET() {
    const { getToken } = await auth();
    const token = await getToken();

    if (!token) {
        return Response.json(
            {
                success: false,
                message: "Authentication is required",
            },
            { status: 401 },
        );
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;

    if (!serverUrl) {
        return Response.json(
            {
                success: false,
                message: "The authentication service is not configured.",
            },
            { status: 500 },
        );
    }

    try {
        const backendResponse = await fetch(`${serverUrl}/api/v1/auth/status?role=client`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        });

        const authStatus = (await backendResponse.json()) as BackendAuthStatusResponse;

        if (!backendResponse.ok) {
            console.error(
                `Backend authentication status failed with status ${backendResponse.status}`
            );
            return Response.json(
                {
                    success: false,
                    message: authStatus.message || "The account is not authorized.",
                },
                { status: backendResponse.status },
            );
        }

        if (!authStatus.data) {
            return Response.json(
                {
                    success: false,
                    message: "The backend returned an invalid account response.",
                },
                { status: 502 },
            );
        }

        return Response.json({
            success: true,
            message: "Account status retrieved.",
            data: authStatus.data,
        });
    } catch (error) {
        console.error("Backend authentication status request failed.", error);
        return Response.json(
            {
                success: false,
                message: "The authentication service is unavailable.",
            },
            { status: 502 },
        );
    }
}
