"use client";

import { useCallback, useEffect, useRef, useReducer } from "react";

const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 30_000;

type RecoveryState = {
    isRetrying: boolean;
    failedAttempts: number;
};

type RecoveryAction =
    | { type: "retry-start" }
    | { type: "retry-success" }
    | { type: "retry-fail"; attempts: number }
    | { type: "reset" };

function recoveryReducer(state: RecoveryState, action: RecoveryAction): RecoveryState {
    switch (action.type) {
        case "retry-start":
            return { isRetrying: true, failedAttempts: state.failedAttempts };
        case "retry-success":
            return { isRetrying: false, failedAttempts: 0 };
        case "retry-fail":
            return { isRetrying: false, failedAttempts: action.attempts };
        case "reset":
            return { isRetrying: false, failedAttempts: 0 };
    }
}

export type ConnectionRecovery = {
    /** True while a retry request is in flight. */
    isRetrying: boolean;
    /** Consecutive failed retries since the screen appeared. */
    failedAttempts: number;
    /** Manual retry for the "Try again" button. */
    retryNow: () => Promise<void>;
};

/**
 * Auto-retries `retryFn` with exponential backoff (3s, 6s, 12s, 24s, then 30s)
 * while `enabled` is true, and retries immediately when the browser fires
 * `online`. `retryFn` must reject when the connection is still down and resolve
 * once it works. Timers and listeners are cleaned up when `enabled` turns false
 * or the component unmounts.
 */
export function useConnectionRecovery(
    retryFn: (() => Promise<void>) | null | undefined,
    enabled: boolean,
): ConnectionRecovery {
    const [state, dispatch] = useReducer(recoveryReducer, {
        isRetrying: false,
        failedAttempts: 0,
    });

    const retryFnRef = useRef(retryFn);
    const runRef = useRef<(() => Promise<void>) | null>(null);

    useEffect(() => {
        retryFnRef.current = retryFn;
    }, [retryFn]);

    // Reset when enabled turns off.
    useEffect(() => {
        if (!enabled) {
            dispatch({ type: "reset" });
        }
    }, [enabled]);

    // Main recovery loop.
    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        let running = false;
        let failures = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const clearTimer = () => {
            if (timer) clearTimeout(timer);
            timer = undefined;
        };

        const schedule = () => {
            clearTimer();
            const delay = Math.min(BASE_DELAY_MS * 2 ** failures, MAX_DELAY_MS);
            timer = setTimeout(() => void run(), delay);
        };

        const run = async (): Promise<void> => {
            if (running || cancelled) return;
            if (!retryFnRef.current) return;
            running = true;
            clearTimer();
            dispatch({ type: "retry-start" });

            try {
                await retryFnRef.current();
                failures = 0;
                dispatch({ type: "retry-success" });
            } catch {
                failures += 1;
                dispatch({ type: "retry-fail", attempts: failures });
                schedule();
            } finally {
                running = false;
            }
        };

        runRef.current = run;

        const onOnline = () => {
            if (!retryFnRef.current) return;
            void run();
        };

        window.addEventListener("online", onOnline);
        schedule(); // first automatic attempt after the base delay

        return () => {
            cancelled = true;
            clearTimer();
            window.removeEventListener("online", onOnline);
        };
    }, [enabled]);

    const retryNow = useCallback(async () => {
        await runRef.current?.();
    }, []);

    return { isRetrying: state.isRetrying, failedAttempts: state.failedAttempts, retryNow };
}
