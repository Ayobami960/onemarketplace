const GLYPH = (
    <>
        <path d="M12 20h.01" />
        <path d="M8.5 16.429a5 5 0 0 1 7 0" />
        <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
        <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
        <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
        <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
        <path d="m2 2 20 20" />
    </>
);

const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
} as const;

/** 72px decorative icon with a soft pulsing ring (disabled for reduced motion). */
export function WifiOffIcon() {
    return (
        <span className="relative inline-flex h-18 w-18 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#52784f]/15 motion-reduce:animate-none" />
            <span className="relative flex h-18 w-18 items-center justify-center rounded-full bg-[#edf4ea] text-[#52784f]">
                <svg className="h-8 w-8" {...svgProps}>
                    {GLYPH}
                </svg>
            </span>
        </span>
    );
}

export function WifiOffSlimIcon({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg className={className} {...svgProps}>
            {GLYPH}
        </svg>
    );
}