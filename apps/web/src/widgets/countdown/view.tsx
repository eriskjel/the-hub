"use client";

import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountdownWidget } from "@/widgets/schema";
import { CountdownData } from "@/widgets/countdown/types";
import { useTranslations } from "next-intl";

function fmtRemain(ms: number, showHours: boolean) {
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return showHours
        ? `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
        : `${d} days`;
}

export default function CountdownView({
    widget,
    data,
}: {
    widget: CountdownWidget;
    data: CountdownData;
}): ReactElement {
    const t = useTranslations("widgets.countdown.view");

    // Tick every minute (or every second only if hours:minutes are shown)
    const showHours = widget.settings.showHours ?? true;
    const [now, setNow] = useState<Date>(new Date());
    const tickRef = useRef<number | null>(null);

    useEffect(() => {
        const intervalMs = showHours ? 1000 : 60_000;

        const start = () => {
            if (!tickRef.current) tickRef.current = window.setInterval(() => setNow(new Date()), intervalMs);
        };
        const stop = () => {
            if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
        };
        const onVis = () => (document.visibilityState === "visible" ? start() : stop());

        start();
        document.addEventListener("visibilitychange", onVis);
        return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
    }, [showHours]);



    const label = useMemo(() => {
        if (widget.settings.source === "provider") {
            const id = widget.settings.provider;
            if (id === "trippel-trumf") return t("providerNames.trippelTrumf");
            if (id === "dnb-supertilbud") return t("providerNames.dnbSupertilbud");
        }
        return widget.title;
    }, [t, widget]);

    const next = data?.nextIso ? new Date(data.nextIso) : null;
    const prev = data?.previousIso ? new Date(data.previousIso) : null;

    const nextDate = next && next.getTime() > now.getTime() ? next : null;
    const remaining = Math.max(0, nextDate ? nextDate.getTime() - now.getTime() : 0);
    const daysSincePrev = prev
        ? Math.floor((now.getTime() - prev.getTime()) / (24 * 3600 * 1000))
        : null;

    return (
        <div className="flex flex-col items-center gap-2 p-2 text-center">
            <div className="text-xs tracking-wide uppercase opacity-70">{label}</div>

            {nextDate ? (
                <>
                    <div className="text-3xl font-bold tabular-nums">
                        {fmtRemain(remaining, showHours)}
                    </div>
                    <div className="text-xs opacity-70">
                        {nextDate.toLocaleString(undefined, {
                            dateStyle: "full",
                            timeStyle: "short",
                        })}
                    </div>
                    <div className="mt-2 h-1 w-full rounded-full bg-black/10">
                        <div
                            className="h-1 rounded-full bg-black/30"
                            style={{
                                width: `${Math.max(0, 100 - (remaining / (7 * 24 * 3600 * 1000)) * 100)}%`,
                            }}
                        />
                    </div>
                </>
            ) : (
                <div className="text-xs opacity-70">
                    {prev
                        ? t("nextNotAnnouncedWithDays", { days: daysSincePrev ?? 0 })
                        : t("nextNotAnnounced")}
                </div>
            )}
        </div>
    );
}
