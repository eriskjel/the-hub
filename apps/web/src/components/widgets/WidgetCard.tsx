"use client";

import { ReactElement, useEffect, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";

function StateText({ children }: { children: React.ReactNode }) {
    return <div className="p-3 text-sm text-white">{children}</div>;
}

function ErrorBox({ msg }: { msg: string }) {
    return (
        <div className="rounded-lg border border-red-400/40 bg-red-400/15 p-3 text-sm text-red-100">
            {msg}
        </div>
    );
}

function cacheKeyFor(userId: string | null, kind: string, instanceId: string) {
    return `hub:u:${userId ?? "anon"}:widget:${kind}:${instanceId}`;
}

function readCachedData<T = unknown>(
    userId: string | null,
    kind: string,
    instanceId: string
): T | null {
    try {
        const raw = localStorage.getItem(cacheKeyFor(userId, kind, instanceId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts?: number; sig?: string; data?: T };
        return parsed && "data" in parsed ? (parsed.data as T) : null;
    } catch {
        return null;
    }
}

function WidgetStatic({
    widget,
    userId,
    preferCache,
}: {
    widget: AnyWidget;
    userId: string | null;
    preferCache: boolean;
}) {
    const entry = registry[widget.kind]!;
    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
    }) => ReactElement;

    const [cached, setCached] = useState<unknown | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
        if (preferCache) {
            const data = readCachedData(userId, widget.kind, widget.instanceId);
            setCached(data);
        }
    }, [preferCache, userId, widget.kind, widget.instanceId]);

    return <Component data={hydrated ? cached : null} widget={widget} />;
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
    staleLayout = false,
}: {
    widget: AnyWidget;
    userId: string | null;
    /** When true, do NOT fetch — render cached/static layout only */
    staleLayout?: boolean;
}) {
    const entry = registry[widget.kind];
    if (!entry) return <StateText>Unknown widget: {widget.kind}</StateText>;

    if (staleLayout) {
        return <WidgetStatic widget={widget} userId={userId} preferCache />;
    }

    if (!entry.fetch) {
        return <WidgetStatic widget={widget} userId={userId} preferCache={false} />;
    }

    return <WidgetWithData widget={widget} userId={userId} />;
}
