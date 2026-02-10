import type { ReactElement } from "react";
import clsx from "clsx";

export function StaleBadge({ solid }: { solid: boolean }): ReactElement {
    return (
        <span
            className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase",
                solid
                    ? "border-stale-muted bg-stale-subtle text-foreground"
                    : "border-stale/40 bg-stale/15 text-stale"
            )}
        >
            Cached
        </span>
    );
}
