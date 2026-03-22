"use client";

import type { ReactElement } from "react";
import { useMemo, useState, useEffect } from "react";
import type { AnyWidget, GroceryDealsWidget, WidgetKind } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";
import GlassCard from "@/components/ui/GlassCard";
import { DeleteWidgetButton } from "@/components/widgets/delete/DeleteWidgetButton";
import { useTranslations } from "next-intl";
import { EditWidgetButton } from "@/components/widgets/edit/EditWidgetButton";
import { isEditableKind } from "@/widgets/create/registry";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { registry } from "@/widgets";
import { IconButton } from "@/components/ui/IconButton";
import { RefreshCw } from "lucide-react";

function useWidgetQueryMeta(widget: AnyWidget, userId: string | null) {
    const queryClient = useQueryClient();
    const settingsSig = JSON.stringify(widget.settings ?? {});
    const qKey = useMemo(
        () => queryKeys.widget(userId ?? "anon", widget.kind, widget.instanceId, settingsSig),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [userId, widget.kind, widget.instanceId, settingsSig]
    );

    const [queryState, setQueryState] = useState(() => queryClient.getQueryState(qKey));
    const [, setTick] = useState(0);

    useEffect(() => {
        setQueryState(queryClient.getQueryState(qKey));
        return queryClient.getQueryCache().subscribe(() => {
            queueMicrotask(() => setQueryState(queryClient.getQueryState(qKey)));
        });
    }, [queryClient, qKey]);

    // Re-render every 30s so the "5m ago" label stays accurate between fetches
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    return {
        dataUpdatedAt: queryState?.dataUpdatedAt,
        isFetching: queryState?.fetchStatus === "fetching",
        refetch: () => queryClient.refetchQueries({ queryKey: qKey, exact: true }),
    };
}

function formatUpdatedAt(
    ms: number | undefined,
    t: ReturnType<typeof useTranslations>
): string | undefined {
    if (!ms) return undefined;
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 30) return t("updatedJustNow");
    if (seconds < 60) return t("updatedSecondsAgo", { count: seconds });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("updatedMinutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    return t("updatedHoursAgo", { count: hours });
}

const KIND_KEYS: Record<WidgetKind, string> = {
    "server-pings": "server-pings",
    "pi-health": "pi-health",
    "grocery-deals": "grocery-deals",
    countdown: "countdown",
    cinemateket: "cinemateket",
};

/** "pepsi max" → "Pepsi Max", "monster" → "Monster" */
function toTitleCase(s: string): string {
    return s
        .split(/\s+/)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ");
}

/** "Trondheim, Trøndelag, Norge" → "Trondheim" */
function cityOnly(raw: string): string {
    return raw.split(",")[0].trim();
}

/** Build a descriptive title; falls back to the translated kind label. */
function resolveTitle(widget: AnyWidget, kindLabel: string): string {
    switch (widget.kind) {
        case "grocery-deals": {
            const s = (widget as GroceryDealsWidget).settings;
            const query = s?.query ? toTitleCase(s.query.trim()) : "";
            const city = s?.city ? cityOnly(s.city) : "";
            if (query && city) return `${query} · ${city}`;
            return query || kindLabel;
        }
        case "countdown": {
            const s = widget.settings;
            if (s?.provider === "trippel-trumf") return "Trippel-Trumf";
            if (s?.provider === "dnb-supertilbud") return "DNB Supertilbud";
            return kindLabel;
        }
        case "server-pings": {
            const target = widget.settings?.target;
            return typeof target === "string" ? target : kindLabel;
        }
        default:
            return kindLabel;
    }
}

export default function WidgetContainer({
    widget,
    userId,
    stale = false,
}: {
    widget: AnyWidget;
    userId: string | null;
    stale?: boolean;
}): ReactElement {
    const tKinds = useTranslations("widgets.create.kinds");
    const tStates = useTranslations("dashboard.states");
    const kindLabel = tKinds(KIND_KEYS[widget.kind]);
    const title = resolveTitle(widget, kindLabel);

    const hasFetch = !!registry[widget.kind]?.fetch;
    const { dataUpdatedAt, isFetching, refetch } = useWidgetQueryMeta(widget, userId);
    const subtitle = hasFetch ? formatUpdatedAt(dataUpdatedAt, tStates) : undefined;

    const header: ReactElement = <Header title={title} subtitle={subtitle} />;
    const actions = (
        <div className="flex items-center gap-2">
            {hasFetch && !stale && (
                <IconButton
                    onClick={() => void refetch()}
                    aria-label="Refresh widget"
                    title="Refresh"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                        aria-hidden
                    />
                </IconButton>
            )}
            {isEditableKind(widget.kind) && (
                <EditWidgetButton
                    widget={widget}
                    userId={userId ?? undefined}
                    backendUnreachable={stale}
                />
            )}
            <DeleteWidgetButton
                widgetId={widget.instanceId}
                widgetTitle={title}
                userId={userId}
                kind={widget.kind}
                backendUnreachable={stale}
            />
        </div>
    );

    // Minimum height for all widgets - can expand beyond this (e.g., grocery expanded)
    // Header ~48px + content ~148px = 196px base
    return (
        <GlassCard
            header={header}
            actions={actions}
            stale={stale}
            variant="solid"
            tone="light"
            className="min-h-[196px] self-start"
        >
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </GlassCard>
    );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }): ReactElement {
    return (
        <div className="min-w-0">
            <div className="text-foreground truncate text-sm font-semibold">{title}</div>
            {subtitle && (
                <div className="text-muted truncate text-[10px] leading-tight">{subtitle}</div>
            )}
        </div>
    );
}
