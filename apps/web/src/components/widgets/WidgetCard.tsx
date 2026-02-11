"use client";

import { ReactElement, ReactNode, useEffect, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { useWidgetData } from "@/hooks/useWidgetData";
import { useTranslations } from "next-intl";

function StateText({ children }: { children: ReactNode }): ReactElement {
    return <div className="p-3 text-sm text-white">{children}</div>;
}

function ErrorBox({ msg }: { msg: string }): ReactElement {
    return (
        <div className="border-error-muted bg-error-subtle text-error rounded-lg border p-3 text-sm">
            {msg}
        </div>
    );
}

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
    const t = useTranslations("dashboard.states");
    const entry = registry[widget.kind]!;
    const interval = entry.pollMs ?? 30_000;
    const { state, refetch } = useWidgetData(widget, interval, userId ?? "anon");

    if (state.status === "loading") return <StateText>{t("loading")}</StateText>;
    if (state.status === "error") return <ErrorBox msg={state.error} />;

    const Component = entry.Component as (props: {
        data: unknown;
        widget: AnyWidget;
        refetch?: () => void;
    }) => ReactElement;
    return <Component data={state.data} widget={widget} refetch={refetch} />;
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
    const t = useTranslations("dashboard.states");
    const entry = registry[widget.kind];
    if (!entry) return <StateText>{t("unknownWidget", { kind: widget.kind })}</StateText>;

    if (staleLayout) {
        return <WidgetStatic widget={widget} userId={userId} preferCache />;
    }

    if (!entry.fetch) {
        return <WidgetStatic widget={widget} userId={userId} preferCache={false} />;
    }

    return <WidgetWithData widget={widget} userId={userId} />;
}
