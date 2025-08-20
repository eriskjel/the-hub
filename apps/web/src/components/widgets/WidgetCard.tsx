"use client";

import type { ReactElement, ReactNode } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";

/** Shell + stale badge – exactly your current styling */
function shell(children: ReactNode, stale?: boolean): ReactElement {
    return (
        <div className="relative rounded-2xl bg-neutral-900 p-4">
            {stale ? <Stale /> : null}
            {children}
        </div>
    );
}
function Stale(): ReactElement {
    return (
        <div className="absolute top-2 right-2 rounded bg-yellow-600/30 px-2 py-0.5 text-[10px] tracking-wide text-yellow-200 uppercase">
            Cached
        </div>
    );
}

/** Render a static widget (no fetch) */
function WidgetStatic({ widget, staleLayout }: { widget: AnyWidget; staleLayout?: boolean }) {
    const entry = registry[widget.kind]!;
    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
    }) => ReactElement;

    return (
        <div className="relative">
            {staleLayout ? <Stale /> : null}
            <Component data={null} widget={widget} />
        </div>
    );
}

/** Render a data-backed widget (uses hook) */
function WidgetWithData({
    widget,
    userId,
    staleLayout,
}: {
    widget: AnyWidget;
    userId: string | null;
    staleLayout?: boolean;
}) {
    const entry = registry[widget.kind]!;
    const interval = entry.pollMs ?? 30_000;
    const state = useWidgetData(widget, interval, userId ?? "anon");
    const showStale = staleLayout || (state.status === "success" && state.stale);

    if (state.status === "loading") return shell("Loading…", showStale);
    if (state.status === "error") {
        return shell(
            <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {state.error}
            </div>,
            showStale
        );
    }

    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
    }) => ReactElement;

    return (
        <div className="relative">
            {showStale ? <Stale /> : null}
            <Component data={state.data} widget={widget} />
        </div>
    );
}

export default function WidgetCard({
    widget,
    userId,
    staleLayout,
}: {
    widget: AnyWidget;
    userId: string | null;
    staleLayout?: boolean;
}) {
    const entry = registry[widget.kind];
    if (!entry) return shell("Unknown widget: " + widget.kind, staleLayout);

    if (!entry.fetch) {
        return <WidgetStatic widget={widget} staleLayout={staleLayout} />;
    }
    return <WidgetWithData widget={widget} userId={userId} staleLayout={staleLayout} />;
}
