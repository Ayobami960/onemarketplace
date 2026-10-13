"use client";

import {
    QueryCache,
    QueryClient,
    QueryClientProvider,
    useQueryClient,
} from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clientApiFetch, isNetworkError } from "@/app/utils/api";
import {
    CONNECTION_ISSUE_EVENT,
    classifyAuthFailure,
    type AuthFailureKind,
} from "./_components/connection/classify-auth-failure";
import { useOnlineStatus } from "./_components/connection/use-online-status";
import { useConnectionRecovery } from "./_components/connection/use-connection-recovery";
import { ConnectionLost } from "./_components/connection/connection-lost";
import { OfflineBanner } from "./_components/connection/offline-banner";

export interface ClientAccount {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    role: "client" | "freelancer";
    emailVerified: boolean;
    identityVerified: boolean;
    isOnboardingComplete: boolean;
}

const ClientAccountContext = createContext<ClientAccount | null>(null);

export const useClientAccount = (): ClientAccount => {
    const account = useContext(ClientAccountContext);
    if (!account) throw new Error("Account is not available outside the dashboard provider.");
    return account;
};

/* -------------------------------------------------------------------------- */
/*                         Config (per-app values only)                       */
/* -------------------------------------------------------------------------- */

const EXPECTED_ROLE = "freelancer" as const;
const WRONG_ROLE_REDIRECT = process.env.NEXT_PUBLIC_CLIENT_DASHBOARD;
const ONBOARDING_PATH = "/profile/edit";
const REQUEST_TIMEOUT_MS = 10_000;

// Evaluated lazily: touching `window` at module level breaks server rendering.
const landingUrl = (path: string): string =>
    new URL(path, process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE ?? window.location.origin).toString();

/* -------------------------------------------------------------------------- */
/*                                  Provider                                  */
/* -------------------------------------------------------------------------- */

export const Provider = ({ children }: { children: React.ReactNode }) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                queryCache: new QueryCache({
                    // Tell the guard when a data request fails because of the network.
                    onError: (error) => {
                        if (isNetworkError(error)) {
                            window.dispatchEvent(new Event(CONNECTION_ISSUE_EVENT));
                        }
                    },
                }),
                defaultOptions: {
                    queries: {
                        retry: (count, error) => isNetworkError(error) && count < 3,
                        retryDelay: (attempt) => Math.min(3000 * 2 ** attempt, 30000),
                        refetchOnReconnect: true,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ClientAuthGuard>{children}</ClientAuthGuard>
        </QueryClientProvider>
    );
};

/* -------------------------------------------------------------------------- */
/*                               Account check                                */
/* -------------------------------------------------------------------------- */

type ProblemKind = Exclude<AuthFailureKind, "unauthenticated">;

type CheckOutcome =
    | { status: "ok" }
    | { status: "redirect" }
    | { status: "error"; kind: ProblemKind };

type AccountBody = { success: boolean; message?: string; data?: ClientAccount };

// A hung request (hotspot without internet) must fail instead of waiting forever.
const fetchWithTimeout = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await clientApiFetch(path, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

// auth/me -> on 401 refresh once -> auth/me again. Returns the deciding response.
const loadAccount = async (): Promise<Response> => {
    const response = await fetchWithTimeout("auth/me");
    if (response.status !== 401) return response;

    const refresh = await fetchWithTimeout("auth/refresh", { method: "POST" });
    if (!refresh.ok) return refresh;

    return fetchWithTimeout("auth/me");
};

/* -------------------------------------------------------------------------- */
/*                                   Guard                                    */
/* -------------------------------------------------------------------------- */

function ClientAuthGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const onlineStatus = useOnlineStatus();

    const [account, setAccount] = useState<ClientAccount | null>(null);
    const [connectionError, setConnectionError] = useState<ProblemKind | null>(null);
    const mountedRef = useRef(true);
    const hadIssueRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const acceptAccount = useCallback(
        (data: ClientAccount): CheckOutcome => {
            if (data.role !== EXPECTED_ROLE) {
                const destination =
                    data.role === "client"
                        ? WRONG_ROLE_REDIRECT
                        : process.env.NEXT_PUBLIC_CLIENT_LANDING_PAGE;
                if (destination) window.location.replace(destination);
                return { status: "redirect" };
            }

            if (!data.emailVerified) {
                window.location.replace(landingUrl("/login?reason=email_not_verified"));
                return { status: "redirect" };
            }

            if (!mountedRef.current) return { status: "ok" };

            setAccount(data);
            setConnectionError(null);

            // Refresh cached data only when coming back from a problem.
            if (hadIssueRef.current) {
                hadIssueRef.current = false;
                void queryClient.invalidateQueries();
            }

            if (!data.isOnboardingComplete && pathname !== ONBOARDING_PATH) {
                router.replace(ONBOARDING_PATH);
            }
            return { status: "ok" };
        },
        [pathname, queryClient, router],
    );

    const attemptCheck = useCallback(async (): Promise<CheckOutcome> => {
        let response: Response;
        try {
            response = await loadAccount();
        } catch (cause) {
            const kind = classifyAuthFailure(cause);
            return { status: "error", kind: kind === "unauthenticated" ? "server_error" : kind };
        }

        if (!response.ok) {
            const kind = classifyAuthFailure(response);
            if (kind === "unauthenticated") {
                window.location.replace(landingUrl("/login"));
                return { status: "redirect" };
            }
            return { status: "error", kind };
        }

        const body = (await response.json().catch(() => null)) as AccountBody | null;
        if (!body?.success || !body.data) return { status: "error", kind: "server_error" };

        return acceptAccount(body.data);
    }, [acceptAccount]);

    // Rejects while the connection is still down, so the recovery hook keeps retrying.
    const checkOrThrow = useCallback(async (): Promise<void> => {
        const outcome = await attemptCheck();
        if (outcome.status === "error") {
            hadIssueRef.current = true;
            if (mountedRef.current) setConnectionError(outcome.kind);
            throw new Error("Connection is still down.");
        }
    }, [attemptCheck]);

    /* ---- initial check (and re-check on route change) ---- */

    useEffect(() => {
        let active = true;
        void attemptCheck().then((outcome) => {
            if (!active || outcome.status !== "error") return;
            hadIssueRef.current = true;
            setConnectionError(outcome.kind);
        });
        return () => {
            active = false;
        };
    }, [attemptCheck]);

    /* ---- data requests that failed because of the network ---- */

    useEffect(() => {
        const onIssue = () => {
            hadIssueRef.current = true;
            setConnectionError((current) => current ?? "offline");
        };
        window.addEventListener(CONNECTION_ISSUE_EVENT, onIssue);
        return () => window.removeEventListener(CONNECTION_ISSUE_EVENT, onIssue);
    }, []);

    const recovery = useConnectionRecovery(checkOrThrow, connectionError !== null);

    /* ---- render ---- */

    if (!account) {
        if (connectionError) {
            return (
                <ConnectionLost
                    variant={connectionError === "offline" ? "offline" : "server"}
                    onRetry={recovery.retryNow}
                    isRetrying={recovery.isRetrying}
                    showRetryNotice={recovery.failedAttempts > 0}
                />
            );
        }
        return (
            <main className="grid min-h-screen place-items-center bg-[#f6f8f4]">
                <span
                    className="h-8 w-8 animate-spin rounded-full border-2 border-[#dce5d9] border-t-[#52784f]"
                    aria-label="Checking account"
                />
            </main>
        );
    }

    return (
        <>
            <OfflineBanner
                offline={connectionError !== null || onlineStatus === "offline"}
                onRetry={() => void checkOrThrow().catch(() => undefined)}
            />
            <ClientAccountContext.Provider value={account}>{children}</ClientAccountContext.Provider>
        </>
    );
}