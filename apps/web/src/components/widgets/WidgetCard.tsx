"use client";

import type { AnyWidget, ServerPingsWidget } from "@/types/widgets/types";
import type { PingsData } from "@/types/widgets/data";
import { registry } from "@/lib/widgets/registry";
import { useWidgetData } from "@/hooks/useWidgetData";

export default function WidgetCard({ widget }: { widget: AnyWidget }) {
    const state = useWidgetData(widget, 30_000);

    // Loading & error UI first
    if (state.status === "loading") {
        return <div className="rounded-2xl bg-neutral-900 p-4">Loading…</div>;
    }
    if (state.status === "error") {
        return <div className="rounded-2xl bg-red-900/40 p-4">Error: {state.error}</div>;
    }

    // At this point, state.status === "success"
    switch (widget.kind) {
        case "server-pings": {
            const entry = registry["server-pings"];
            if (!entry) {
                return (
                    <div className="rounded-2xl bg-neutral-900 p-4">
                        Unknown widget: server-pings
                    </div>
                );
            }
            const { Component } = entry;
            // Narrow the types here
            const data = state.data as PingsData;
            const w = widget as ServerPingsWidget;
            return <Component data={data} widget={w} />;
        }

        case "pi-health":
            // Implement when wiring the registry + component for pi-health
            return <div className="rounded-2xl bg-neutral-900 p-4">Pi Health: not implemented</div>;
    }
}
