"use client";

import { ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";
import { WidgetListItem } from "@/widgets/rows";
import SeedWidgetsCacheWithRows from "@/components/widgets/_internal/SeedWidgetsCacheWithRows";

interface WidgetsGridProps {
    widgetsResult: {
        widgets: AnyWidget[];
        rows?: WidgetListItem[];
        error?: string;
        stale?: boolean;
        offline?: boolean;
    };
}

export default function WidgetsGrid({ widgetsResult }: WidgetsGridProps): ReactElement {
    const { widgets, rows, error, stale, offline } = widgetsResult;

    // Seed cookie only when fresh data is present (not stale)
    const maybeSeed: ReactElement | null =
        !stale && widgets.length > 0 && rows && rows.length > 0 ? (
            <SeedWidgetsCacheWithRows rows={rows} />
        ) : null;

    if (stale) {
        return (
            <div className="space-y-4">
                <div className="text-white-300 rounded-lg border border-red-500/30 bg-red-500/50 p-4 text-center">
                    Showing cached data — live updates unavailable
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {widgets.map(
                        (widget: AnyWidget): ReactElement => (
                            <WidgetContainer key={widget.instanceId} widget={widget} stale />
                        )
                    )}
                </div>
            </div>
        );
    }

    // No widgets + offline -> neutral “temporarily unavailable”
    if (widgets.length === 0 && offline) {
        return (
            <section className="py-10">
                <div className="mx-auto max-w-md text-center text-neutral-300">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                        <h3 className="mb-2 text-lg font-semibold">
                            Widgets temporarily unavailable
                        </h3>
                        <p className="text-sm text-neutral-400">
                            We can’t reach the service right now. Try again in a bit.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // No widgets + no error -> true empty state
    if (!error && widgets.length === 0) {
        return (
            <section className="py-10">
                <div className="mx-auto max-w-md text-center text-neutral-300">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                        <h3 className="mb-2 text-lg font-semibold">No widgets yet</h3>
                        <p className="text-sm text-neutral-400">
                            Add your first widget to get started.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // HTTP-ish error with no widgets -> show error
    if (error && widgets.length === 0) {
        return (
            <section className="py-10">
                <div className="mx-auto max-w-md text-center">
                    <div className="inline-block rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                        <h3 className="mb-2 text-lg font-semibold">Unable to Load Dashboard</h3>
                        <p className="text-sm">
                            {process.env.NODE_ENV === "development" ? error : "An error occurred."}
                        </p>
                        <p className="mt-2 text-xs text-red-400">Please try refreshing the page.</p>
                    </div>
                </div>
            </section>
        );
    }

    // Normal operation (fresh)
    return (
        <>
            {maybeSeed}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {widgets.map(
                    (widget: AnyWidget): ReactElement => (
                        <WidgetContainer key={widget.instanceId} widget={widget} />
                    )
                )}
            </div>
        </>
    );
}

function WidgetContainer({
    widget,
    stale = false,
}: {
    widget: AnyWidget;
    stale?: boolean;
}): ReactElement {
    return (
        <div className="rounded-2xl bg-neutral-900 p-2">
            <div className="px-2 py-1 text-sm text-neutral-400">{widget.title}</div>
            <WidgetCard widget={widget} staleLayout={stale} />
        </div>
    );
}
