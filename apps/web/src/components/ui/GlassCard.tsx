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

    const base =
        "relative overflow-hidden rounded-2xl border shadow-xl transition-colors flex flex-col";
    const look = isSolid
        ? "bg-white/90 border-neutral-200 shadow-black/10"
        : clsx(
              "border-white/20 bg-white/[0.08] shadow-black/20",
              "supports-[backdrop-filter]:bg-white/[0.07] supports-[backdrop-filter]:backdrop-blur-md",
              "supports-[backdrop-filter]:backdrop-brightness-95 supports-[backdrop-filter]:backdrop-contrast-125",
              "hover:border-white/25"
          );
    const textTone = isLight ? "text-neutral-900" : "text-white";

    return (
        <div className={clsx(base, look, className)}>
            {!isSolid && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/5" />
            )}

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

            <div className={clsx("relative z-[1] px-3 pb-3", textTone, "flex flex-1 flex-col")}>
                {children}
            </div>

            {footer && (
                <div
                    className={clsx(
                        "relative z-[1] px-3 py-2",
                        isSolid ? "border-t border-neutral-200" : "border-t border-white/15",
                        textTone,
                        "flex-none"
                    )}
                >
                    {footer}
                </div>
            )}
        </div>
    );
}
