import type { ReactElement } from "react";
import clsx from "clsx";

export function StaleBadge({ solid }: { solid: boolean }): ReactElement {
    return (
        <span
            className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase",
                solid
                    ? "border border-amber-400/40 bg-amber-100 text-amber-900"
                    : "border border-yellow-300/40 bg-yellow-300/15 text-yellow-100"
            )}
        >
            Cached
        </span>
    );
}
