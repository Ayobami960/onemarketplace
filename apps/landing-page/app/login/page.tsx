"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "../_components/landing-page/brand-mark";
import { LoginForm } from "./login-form";
import { fetchCurrentAccount, redirectToDashboard } from "../_components/auth-api";
import { ConnectionLost } from "../_components/connection/connection-lost";
import { classifyAuthFailure } from "../_components/connection/classify-auth-failure";
import { useConnectionRecovery } from "../_components/connection/use-connection-recovery";

type View = "checking" | "form" | "offline" | "server";

export default function LoginPage() {
    const [view, setView] = useState<View>("checking");
    const mountedRef = useRef(true);
    const startedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Resolves when the check reached a decision (redirect or show the form).
    // Rejects while the connection is down, so the recovery hook keeps retrying.
    const checkSession = useCallback(async (): Promise<void> => {
        let account: Awaited<ReturnType<typeof fetchCurrentAccount>>;

        try {
            account = await fetchCurrentAccount();
        } catch (error) {
            if (!mountedRef.current) return;
            const kind = classifyAuthFailure(error);

            // A real 401/403: the visitor simply isn't signed in.
            if (kind === "unauthenticated") {
                setView("form");
                return;
            }

            setView(kind === "offline" ? "offline" : "server");
            throw new Error("Session check failed: connection problem.");
        }

        if (!mountedRef.current) return;

        // Signed in: keep the spinner visible while redirecting.
        setView("checking");
        try {
            await redirectToDashboard(account.role);
        } catch {
            // e.g. the dashboard URL is not configured. Not a connection problem.
            if (mountedRef.current) setView("form");
        }
    }, []);

    // First check on mount. The ref guard avoids a double request in React Strict Mode.
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        void checkSession().catch(() => undefined);
    }, [checkSession]);

    const connectionProblem = view === "offline" || view === "server";
    const recovery = useConnectionRecovery(checkSession, connectionProblem);

    // ConnectionLost renders its own full-screen <main>, so render it on its own.
    if (connectionProblem) {
        return (
            <ConnectionLost
                variant={view === "offline" ? "offline" : "server"}
                onRetry={recovery.retryNow}
                isRetrying={recovery.isRetrying}
                showRetryNotice={recovery.failedAttempts > 0}
            />
        );
    }

    return (
        <div className="relative flex min-h-svh flex-col overflow-hidden bg-white font-(family-name:--font-dm-sans)">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-128 bg-[radial-gradient(ellipse_at_top,rgba(224,246,220,0.8),rgba(247,252,245,0.48)_44%,transparent_76%)]"
                aria-hidden="true"
            />

            <header className="relative z-10 px-5 py-7 sm:px-8 sm:py-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2.5"
                    aria-label="OneMarketplace.io home"
                >
                    <BrandMark />
                    <span className="text-xl font-semibold tracking-tight">OneMarketplace.io</span>
                </Link>
            </header>

            <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
                {view === "form" ? (
                    <LoginForm />
                ) : (
                    <span
                        className="h-8 w-8 animate-spin rounded-full border-2 border-[#dce5d9] border-t-[#52784f]"
                        role="status"
                        aria-label="Checking your session"
                    />
                )}
            </main>
        </div>
    );
}