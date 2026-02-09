import type { ReactElement, ReactNode } from "react";
import { StaleBadge } from "@/components/ui/StaleBadge";
import clsx from "clsx";

type Variant = "solid" | "glass";
type Tone = "light" | "dark";

export default function GlassCard({
    header,
    actions,
    footer,
    children,
    stale,
    className,
    variant = "solid",
    tone = "light",
}: {
    header?: ReactNode;
    actions?: ReactNode; // right-aligned controls (e.g., delete)
    footer?: ReactNode; // bottom bar (e.g., secondary info/links)
    children: ReactNode; // main card content
    stale?: boolean; // shows "Cached" badge if true
    className?: string;
    variant?: Variant;
    tone?: Tone;
}): ReactElement {
    const isSolid = variant === "solid";
    const isLight = tone === "light";

    const base = "relative overflow-hidden rounded-2xl transition-all duration-300 flex flex-col";
    
    // Modern glassmorphism - uses CSS class defined in globals.css for theme-aware styling
    const look = isSolid
        ? "widget-glass"
        : clsx(
              "bg-white/10 border border-white/20 shadow-xl",
              "supports-[backdrop-filter]:bg-white/[0.07] supports-[backdrop-filter]:backdrop-blur-md",
              "supports-[backdrop-filter]:backdrop-saturate-150"
          );
    
    const textTone = isLight ? "text-foreground" : "text-white";

    return (
        <div className={clsx(base, look, className)}>
            {/* Subtle inner glow for depth */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl widget-glass-glow" />

            {(header || actions || stale) && (
                <div
                    className={clsx(
                        "relative z-[1] flex items-center justify-between gap-2 px-3 pt-3 pb-2",
                        textTone,
                        "flex-none"
                    )}
                >
                    <div className="min-w-0">{header}</div>
                    <div className="flex items-center gap-2">
                        {stale ? <StaleBadge solid={isSolid} /> : null}
                        {actions}
                    </div>
                </div>
            )}

            <div
                className={clsx("relative z-[1] flex min-h-0 flex-1 flex-col px-3 pb-3", textTone)}
            >
                {children}
            </div>

            {footer && (
                <div className={clsx("relative z-[1] px-3 py-2", textTone, "flex-none")}>
                    {footer}
                </div>
            )}
        </div>
    );
}
