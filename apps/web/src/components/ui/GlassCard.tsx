import type { ReactElement, ReactNode } from "react";

type Variant = "solid" | "glass";
type Tone = "light" | "dark";

export default function GlassCard({
    header,
    footer,
    children,
    stale,
    className,
    variant = "solid",
    tone = "light",
}: {
    header?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    stale?: boolean;
    className?: string;
    variant?: Variant;
    tone?: Tone;
}): ReactElement {
    const isSolid = variant === "solid";
    const isLight = tone === "light";

    const base = "relative overflow-hidden rounded-2xl border shadow-xl transition-colors";
    const look = isSolid
        ? // SOLID, OPAQUE (white card + dark-ish border)
          "bg-white/90 border-neutral-200 shadow-black/10"
        : // GLASS (kept for future use)
          [
              "border-white/20 bg-white/[0.08] shadow-black/20",
              "supports-[backdrop-filter]:bg-white/[0.07] supports-[backdrop-filter]:backdrop-blur-md",
              "supports-[backdrop-filter]:backdrop-brightness-95 supports-[backdrop-filter]:backdrop-contrast-125",
              "hover:border-white/25",
          ].join(" ");

    const textTone = isLight ? "text-neutral-900" : "text-white";

    return (
        <div className={[base, look, className].join(" ")}>
            {/* scrim only for glass */}
            {!isSolid && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/5" />
            )}

            {stale ? (
                <span
                    className={[
                        "absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase",
                        isSolid
                            ? "border border-amber-400/40 bg-amber-100 text-amber-900"
                            : "border border-yellow-300/40 bg-yellow-300/15 text-yellow-100",
                    ].join(" ")}
                >
                    Cached
                </span>
            ) : null}

            {header ? (
                <div
                    className={`relative z-[1] flex items-center justify-between gap-2 px-3 pt-3 pb-2 ${textTone}`}
                >
                    {header}
                </div>
            ) : null}

            <div className={`relative z-[1] px-3 pb-3 ${textTone}`}>{children}</div>

            {footer ? (
                <div
                    className={[
                        "relative z-[1] px-3 py-2",
                        isSolid ? "border-t border-neutral-200" : "border-t border-white/15",
                        textTone,
                    ].join(" ")}
                >
                    {footer}
                </div>
            ) : null}
        </div>
    );
}
