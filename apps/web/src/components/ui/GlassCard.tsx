import type { ReactElement, ReactNode } from "react";

export default function GlassCard({
    header,
    footer,
    children,
    stale,
    className,
}: {
    header?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    stale?: boolean;
    className?: string;
}): ReactElement {
    return (
        <div
            className={[
                "relative overflow-hidden rounded-2xl border shadow-xl",
                // ↑ slightly denser than before
                "border-white/20 bg-white/[0.08] shadow-black/20",
                "supports-[backdrop-filter]:bg-white/[0.07] supports-[backdrop-filter]:backdrop-blur-md",
                // boost brightness/contrast for readability where supported
                "supports-[backdrop-filter]:backdrop-brightness-95 supports-[backdrop-filter]:backdrop-contrast-125",
                "transition-colors hover:border-white/25",
                className,
            ].join(" ")}
        >
            {/* subtle top-to-bottom scrim to lift text off bright gradients */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/5" />

            {stale ? (
                <span className="absolute top-3 right-3 rounded-full border border-yellow-300/40 bg-yellow-300/15 px-2 py-0.5 text-[10px] tracking-wide text-yellow-100 uppercase">
                    Cached
                </span>
            ) : null}

            {header ? (
                <div className="relative z-[1] flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                    {header}
                </div>
            ) : null}

            <div className="relative z-[1] px-3 pb-3">{children}</div>

            {footer ? (
                <div className="relative z-[1] border-t border-white/15 px-3 py-2">{footer}</div>
            ) : null}
        </div>
    );
}
