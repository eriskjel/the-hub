"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetContainer from "../WidgetContainer";
import { useTranslations } from "next-intl";

function oldestCacheTs(widgets: AnyWidget[], userId: string | null): number | null {
    let oldest: number | null = null;
    for (const w of widgets) {
        try {
            const key = `hub:u:${userId ?? "anon"}:widget:${w.kind}:${w.instanceId}`;
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as { ts?: number };
            if (typeof parsed.ts === "number") {
                if (oldest === null || parsed.ts < oldest) oldest = parsed.ts;
            }
        } catch {}
    }
    return oldest;
}

export default function StaleState({
    widgets,
    userId,
}: {
    widgets: AnyWidget[];
    userId: string | null;
}): ReactElement {
    const t = useTranslations("dashboard.states");
    const [cacheAge, setCacheAge] = useState<string | null>(null);

    useEffect(() => {
        const ts = oldestCacheTs(widgets, userId);
        if (ts == null) return;
        const minutes = Math.floor((Date.now() - ts) / 60_000);
        if (minutes < 60) {
            setCacheAge(t("staleAgeMinutes", { count: minutes }));
        } else {
            const hours = Math.floor(minutes / 60);
            setCacheAge(t("staleAgeHours", { count: hours }));
        }
    }, [widgets, userId, t]);

    return (
        <div className="space-y-4 text-white">
            <div className="border-status-error-muted bg-status-error/50 rounded-lg border p-4 text-center">
                <div>{t("staleBanner")}</div>
                {cacheAge && <div className="mt-1 text-xs opacity-75">{cacheAge}</div>}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {widgets.map(
                    (widget: AnyWidget): ReactElement => (
                        <WidgetContainer
                            key={widget.instanceId}
                            widget={widget}
                            userId={userId}
                            stale
                        />
                    )
                )}
            </div>
        </div>
    );
}
