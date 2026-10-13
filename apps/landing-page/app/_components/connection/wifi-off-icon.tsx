import React from "react";

type Props = { className?: string };

export const WifiOffIcon: React.FC<Props> = ({ className }) => (
    <svg
        className={`${className ?? "h-18 w-18"} motion-reduce:animate-none`}
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden="true"
    >
        <circle
            cx="36"
            cy="36"
            r="34"
            fill="#edf4ea"
            stroke="#52784f"
            strokeWidth="1.5"
        />
        <path
            d="M26.5 29.5a5 5 0 0 1 7 0l5.66 5.66a5 5 0 0 1 0 7L29.5 43a5 5 0 0 1 -7 -7l5.66 -5.66z"
            fill="#52784f"
        />
        <path
            d="M36 48.5v4M30 52.5h12"
            stroke="#52784f"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
);
