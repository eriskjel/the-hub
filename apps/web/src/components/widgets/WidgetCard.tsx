"use client";
import type { AnyWidget } from "@/types/widgets/types";
import { registry } from "@/lib/widgets/registry";
import { useWidgetData } from "@/hooks/useWidgetData";

export default function WidgetCard({ widget }: { widget: AnyWidget }) {
    const entry = registry[widget.kind as keyof typeof registry];
    if (!entry)
        return <div className="rounded-2xl bg-neutral-900 p-4">Unknown widget: {widget.kind}</div>;

    const state = useWidgetData(widget, 30_000);

    if (state.status === "loading")
        return <div className="rounded-2xl bg-neutral-900 p-4">Loading…</div>;
    if (state.status === "error")
        return <div className="rounded-2xl bg-red-900/40 p-4">Error: {state.error}</div>;

    const Comp = entry.Component as any;
    return <Comp data={state.data} widget={widget as any} />;
}
