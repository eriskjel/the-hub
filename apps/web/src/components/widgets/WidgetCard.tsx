"use client";

import type { ReactElement, ReactNode } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";

function StateText({ children }: { children: ReactNode }) {
    return <div className="p-3 text-sm text-white">{children}</div>;
}

function ErrorBox({ msg }: { msg: string }) {
    return (
        <div className="rounded-lg border border-red-400/40 bg-red-400/15 p-3 text-sm text-red-100">
            {msg}
        </div>
    );
}

function WidgetStatic({ widget }: { widget: AnyWidget }) {
    const entry = registry[widget.kind]!;
    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
    }) => ReactElement;
    return <Component data={null} widget={widget} />;
}

function WidgetWithData({ widget, userId }: { widget: AnyWidget; userId: string | null }) {
    const entry = registry[widget.kind]!;
    const interval = entry.pollMs ?? 30_000;
    const state = useWidgetData(widget, interval, userId ?? "anon");

    if (state.status === "loading") return <StateText>Loading…</StateText>;
    if (state.status === "error") return <ErrorBox msg={state.error} />;

    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
    }) => ReactElement;
    return <Component data={state.data} widget={widget} />;
}

export default function WidgetCard({
    widget,
    userId,
}: {
    widget: AnyWidget;
    userId: string | null;
    staleLayout?: boolean;
}) {
    const entry = registry[widget.kind];
    if (!entry) return <StateText>Unknown widget: {widget.kind}</StateText>;
    if (!entry.fetch) return <WidgetStatic widget={widget} />;
    return <WidgetWithData widget={widget} userId={userId} />;
}
