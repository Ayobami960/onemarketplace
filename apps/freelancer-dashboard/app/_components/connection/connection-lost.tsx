"use client";

import { useEffect, useRef } from "react";
import { WifiOffIcon } from "./wifi-off-icon";

interface ConnectionLostProps {
    variant: "offline" | "server";
    onRetry: () => Promise<void>;
    isRetrying: boolean;
    showRetryNotice: boolean;
}

export function ConnectionLost({ variant, onRetry, isRetrying, showRetryNotice }: ConnectionLostProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        buttonRef.current?.focus();
    }, []);

    const title = variant === "offline" ? "You're offline" : "Can't reach the server";
    const body =
        variant === "offline"
            ? "Check your connection and try again. You're still signed in and your data is safe."
            : "The server isn't responding right now. You're still signed in and your data is safe.";

    return (
        <main className="grid min-h-screen place-items-center bg-[#f6f8f4] px-6 py-12 font-(family-name:--font-dm-sans)">
            <section
                role="alert"
                aria-live="polite"
                className="w-full max-w-105 rounded-2xl border border-black/8 bg-white px-8 py-10 text-center shadow-sm"
            >
                <div className="mx-auto mb-6 flex justify-center">
                    <WifiOffIcon />
                </div>

                <h1 className="text-xl font-semibold text-[#252724]">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-[#72776f]">{body}</p>

                {showRetryNotice && (
                    <p className="mt-4 text-sm text-[#72776f]">Still can't connect. Retrying automatically.</p>
                )}

                <div className="mt-6 flex flex-col gap-3">
                    <button
                        ref={buttonRef}
                        type="button"
                        disabled={isRetrying}
                        onClick={() => void onRetry().catch(() => undefined)}
                        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#252724] px-5 text-sm font-semibold text-white transition hover:bg-[#3b3e39] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52784f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isRetrying && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        )}
                        {isRetrying ? "Retrying" : "Try again"}
                    </button>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="h-11 cursor-pointer rounded-xl px-5 text-sm font-semibold text-[#52784f] transition hover:bg-[#edf4ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52784f]"
                    >
                        Reload page
                    </button>
                </div>
            </section>
        </main>
    );
}