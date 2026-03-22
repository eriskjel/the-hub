"use client";

import { ReactElement, useEffect, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";
import WidgetContentSkeleton from "@/components/widgets/WidgetContentSkeleton";
import WidgetErrorBoundary from "@/components/widgets/WidgetErrorBoundary";
import { WidgetErrorBox } from "@/components/widgets/WidgetErrorBox";

function cacheKeyFor(userId: string | null, kind: string, instanceId: string): string {
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
}): ReactElement {
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

function WidgetWithData({
    widget,
    userId,
}: {
    widget: AnyWidget;
    userId: string | null;
}): ReactElement {
    const entry = registry[widget.kind]!;
    const interval = entry.pollMs ?? 30_000;
    const { data, isPending, isError, error, refetch } = useWidgetData(
        widget,
        interval,
        userId ?? "anon"
    );

    if (isPending) return <WidgetContentSkeleton />;
    if (isError && error) return <WidgetErrorBox error={error} refetch={refetch} />;

    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
        refetch?: () => void;
    }) => ReactElement;

    return <Component data={data} widget={widget} refetch={refetch} />;
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
}): ReactElement {
    const entry = registry[widget.kind];
    if (!entry) return <WidgetErrorBox error={new Error(`Unknown widget type: ${widget.kind}`)} />;

    if (staleLayout) {
        return <WidgetStatic widget={widget} userId={userId} preferCache />;
    }

    if (!entry.fetch) {
        return <WidgetStatic widget={widget} userId={userId} preferCache={false} />;
    }

    return (
        <WidgetErrorBoundary>
            <WidgetWithData widget={widget} userId={userId} />
        </WidgetErrorBoundary>
    );
}
