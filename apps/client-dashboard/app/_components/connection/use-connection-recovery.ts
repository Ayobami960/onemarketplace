"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 30_000;

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
 * `online`. `retryFn` must reject while the connection is down and resolve on
 * success. Timers and listeners are cleaned up when `enabled` turns false or
 * the component unmounts.
 */
export function useConnectionRecovery(
    retryFn: () => Promise<void>,
    enabled: boolean,
): ConnectionRecovery {
    const [isRetrying, setIsRetrying] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);

    const retryFnRef = useRef(retryFn);
    const runNowRef = useRef<(() => Promise<void>) | null>(null);

    // Always call the latest retryFn without restarting the backoff.
    useEffect(() => {
        retryFnRef.current = retryFn;
    }, [retryFn]);

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
            running = true;
            clearTimer();
            setIsRetrying(true);

            try {
                await retryFnRef.current();
                failures = 0;
            } catch {
                failures += 1;
                if (!cancelled) {
                    setFailedAttempts(failures);
                    schedule();
                }
            } finally {
                running = false;
                if (!cancelled) setIsRetrying(false);
            }
        };

        const onOnline = () => void run();

        runNowRef.current = run;
        window.addEventListener("online", onOnline);
        schedule(); // first automatic attempt after the base delay

        return () => {
            cancelled = true;
            clearTimer();
            window.removeEventListener("online", onOnline);
            runNowRef.current = null;
            setIsRetrying(false);
            setFailedAttempts(0);
        };
    }, [enabled]);

    const retryNow = useCallback(async () => {
        await runNowRef.current?.();
    }, []);

    return { isRetrying, failedAttempts, retryNow };
}