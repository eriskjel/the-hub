import type { ReactElement } from "react";

/** Generic pulsing content skeleton shown while a widget's data loads.
 *  Shaped like a list of rows (icon + text + value) — matches most widget kinds. */
export default function WidgetContentSkeleton(): ReactElement {
    return (
        <div className="space-y-2.5 py-1" aria-hidden>
            <SkeletonRow wide />
            <SkeletonRow />
            <SkeletonRow wide={false} faint />
        </div>
    );
}

function SkeletonRow({
    wide = true,
    faint = false,
}: {
    wide?: boolean;
    faint?: boolean;
}): ReactElement {
    return (
        <div
            className="flex items-center gap-3 transition-opacity"
            style={{ opacity: faint ? 0.5 : 1 }}
        >
            {/* Icon placeholder */}
            <div className="bg-surface-subtle h-8 w-8 shrink-0 animate-pulse rounded-md" />

            {/* Text lines */}
            <div className="flex-1 space-y-1.5">
                <div
                    className="bg-surface-subtle h-3 animate-pulse rounded"
                    style={{ width: wide ? "75%" : "55%" }}
                />
                <div className="bg-surface-subtle h-2.5 w-2/5 animate-pulse rounded" />
            </div>

            {/* Value placeholder */}
            <div className="bg-surface-subtle h-4 w-12 shrink-0 animate-pulse rounded" />
        </div>
    );
}
