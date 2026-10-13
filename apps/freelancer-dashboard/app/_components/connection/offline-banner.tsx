"use client";

import { useEffect, useState } from "react";
import { WifiOffSlimIcon } from "./wifi-off-icon";

interface OfflineBannerProps {
    offline: boolean;
    onRetry: () => void;
}

const BACK_ONLINE_MS = 2_000;

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
    const [previous, setPrevious] = useState(offline);
    const [showBackOnline, setShowBackOnline] = useState(false);

    // Adjust state during render when the prop changes (no effect needed).
    if (previous !== offline) {
        setPrevious(offline);
        setShowBackOnline(!offline);
    }

    useEffect(() => {
        if (!showBackOnline) return;
        const timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_MS);
        return () => clearTimeout(timer);
    }, [showBackOnline]);

    if (!offline && !showBackOnline) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center gap-3 border-b border-black/8 bg-white/95 px-4 shadow-sm backdrop-blur"
        >
            <WifiOffSlimIcon className="h-4 w-4 text-[#52784f]" />
            <span className="text-xs font-medium text-[#72776f]">
                {offline ? "You're offline. Some features may not work." : "Back online"}
            </span>
            {offline && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="cursor-pointer text-xs font-semibold text-[#4e774b] underline underline-offset-2 hover:text-[#3f6a3c]"
                >
                    Retry
                </button>
            )}
        </div>
    );
}