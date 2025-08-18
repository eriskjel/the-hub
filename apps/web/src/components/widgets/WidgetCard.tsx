"use client";

import { ReactElement } from "react";
import type { AnyWidget, ServerPingsWidget } from "@/widgets/schema";
import type { PingsData } from "@/widgets/server-pings/types";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";

export default function WidgetCard({
    widget,
    staleLayout,
}: {
    widget: AnyWidget;
    staleLayout?: boolean;
}): ReactElement {
    const state = useWidgetData(widget, 30_000);

    const isStaleData = state.status === "success" && state.stale;
    const showStaleBadge = staleLayout || isStaleData;

    const StaleBadge = showStaleBadge ? (
        <div className="absolute top-2 right-2 rounded bg-yellow-600/30 px-2 py-0.5 text-[10px] tracking-wide text-yellow-200 uppercase">
            Cached
        </div>
    ) : null;

    if (state.status === "loading") {
        return (
            <div className="relative rounded-2xl bg-neutral-900 p-4">
                {StaleBadge}
                Loading…
            </div>
        );
    }

    if (state.status === "error") {
        return (
            <div className="relative rounded-2xl bg-neutral-900 p-4">
                {StaleBadge}
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {state.error}
                </div>
            </div>
        );
    }

    // success
    switch (widget.kind) {
        case "server-pings": {
            const entry = registry["server-pings"];
            if (!entry) {
                return (
                    <div className="relative rounded-2xl bg-neutral-900 p-4">
                        {StaleBadge}
                        Unknown widget: server-pings
                    </div>
                );
            }
            const { Component } = entry;
            const data = state.data as PingsData;
            const w = widget as ServerPingsWidget;
            return (
                <div className="relative">
                    {StaleBadge}
                    <Component data={data} widget={w} />
                </div>
            );
        }

        // ...other kinds
        default:
            return (
                <div className="relative rounded-2xl bg-neutral-900 p-4">
                    {StaleBadge}
                    Unknown widget: {widget.kind}
                </div>
            );
    }
}
