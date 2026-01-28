import type { ReactElement } from "react";
import clsx from "clsx";

export function StaleBadge({ solid }: { solid: boolean }): ReactElement {
    return (
        <span
            className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase",
                solid
                    ? "border-status-error-muted bg-status-error-subtle text-neutral-900"
                    : "border-status-error/40 bg-status-error/15 text-status-error-subtle"
            )}
        >
            Cached
        </span>
    );
}
