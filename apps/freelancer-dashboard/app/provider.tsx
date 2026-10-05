"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { createContext, useContext, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { clientApiFetch } from "@/app/utils/api";

export interface ClientAccount {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    role: "client" | "freelancer";
    emailVerified: boolean;
    identityVerified: boolean;
    isOnboardingComplete: boolean;
}

const ClientAccountContext = createContext<ClientAccount | null>(null);

export const useClientAccount = (): ClientAccount => {
    const account = useContext(ClientAccountContext);
    if (!account) throw new Error("Freelancer Account is not available outside the dashboard provider.");
    return account;
};

export const Provider = ({children}: {children: React.ReactNode}) => {
    const [queryClient] = React.useState(() => new QueryClient());
    return (
        <QueryClientProvider client={queryClient}>
            <ClientAuthGuard>{children}</ClientAuthGuard>
        </QueryClientProvider>
    )
}

function ClientAuthGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [account, setAccount] = useState<ClientAccount | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const checkAccount = async () => {
            try {
                let response = await clientApiFetch("auth/me");
                if (response.status === 401) {
                    const refreshResponse = await clientApiFetch("auth/refresh", { method: "POST" });
                    if (!refreshResponse.ok) {
                        const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE ?? window.location.origin;
                        window.location.replace(new URL("/login", landingPage).toString());
                        return;
                    }
                    response = await clientApiFetch("auth/me");
                }
                if (response.status === 401 || response.status === 403) {
                    const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE ?? window.location.origin;
                    window.location.replace(new URL("/login", landingPage).toString());
                    return;
                }
                const result = await response.json() as {
                    success: boolean;
                    message?: string;
                    data?: ClientAccount;
                };
                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.message || "Your account could not be checked.");
                }
                if (result.data.role !== "freelancer") {
                    const destination = result.data.role === "client"
                        ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
                        : process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE;
                    if (destination) window.location.replace(destination);
                    return;
                }
                if (!result.data.emailVerified) {
                    const landingPage = process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE ?? window.location.origin;
                    window.location.replace(new URL("/login?reason=email_not_verified", landingPage).toString());
                    return;
                }
                if (!active) return;
                setAccount(result.data);
                setError("");
                if (!result.data.isOnboardingComplete && pathname !== "/profile/edit") {
                    router.replace("/profile/edit");
                }
            } catch (cause) {
                if (active) setError(cause instanceof Error ? cause.message : "The authentication service is unavailable.");
            }
        };

        void checkAccount();
        return () => { active = false; };
    }, [pathname, router]);

    if (error) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#f6f8f4] px-6">
                <section className="w-full max-w-md text-center">
                    <h1 className="text-xl font-semibold text-[#252724]">Can’t load your account</h1>
                    <p className="mt-3 text-sm leading-6 text-[#72776f]">{error}</p>
                    <button 
                        type="button" 
                        onClick={() => window.location.reload()} 
                        className="mt-6 h-11 rounded-xl bg-[#252724] px-5 text-sm font-semibold text-white">
                        Try again
                    </button>
                </section>
            </main>
        );
    }

    if (!account) {
        return (
        <main className="grid min-h-screen place-items-center bg-[#f6f8f4]">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#dce5d9] border-t-[#52784f]" aria-label="Checking account" />
        </main>)
    };

    return (
    <ClientAccountContext.Provider value={account}>
        {children}
    </ClientAccountContext.Provider>
)};