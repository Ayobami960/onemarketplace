"use client";

import { useSyncExternalStore } from "react";

export type OnlineStatus = "online" | "offline" | "unknown";

const getSnapshot = (): OnlineStatus => (navigator.onLine ? "online" : "offline");

// Used for server rendering and the hydration pass.
const getServerSnapshot = (): OnlineStatus => "unknown";

const subscribe = (callback: () => void): (() => void) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
    };
};

/**
 * Browser connectivity hint. `navigator.onLine` is unreliable (a Wi-Fi network or
 * hotspot with no internet still reports "online"), so use this only as a hint and
 * rely on failed requests for the real decision. Compare with === "offline".
 */
export function useOnlineStatus(): OnlineStatus {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}