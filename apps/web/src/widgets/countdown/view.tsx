"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { CountdownWidget } from "@/widgets/schema";
import { CountdownData } from "@/widgets/countdown/types";
import { useTranslations, useFormatter } from "next-intl";

export default function CountdownView({
    widget,
    data,
}: {
    widget: CountdownWidget;
    data: CountdownData;
}): ReactElement {
    const t = useTranslations("widgets.countdown.view");
    const format = useFormatter();

    // Tick every minute (or every second only if hours:minutes are shown)
    const showHours = widget.settings.showHours ?? true;
    const [now, setNow] = useState<Date>(new Date());
    const tickRef = useRef<number | null>(null);

    useEffect(() => {
        setNow(new Date());
    }, []);

    useEffect(() => {
        const intervalMs = showHours ? 1000 : 60_000;

        const start = () => {
            if (!tickRef.current) {
                tickRef.current = window.setInterval(() => setNow(new Date()), intervalMs);
            }
        };
        const stop = () => {
            if (tickRef.current) {
                window.clearInterval(tickRef.current);
                tickRef.current = null;
            }
        };
        const onVisible = () => (document.visibilityState === "visible" ? start() : stop());

        start();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            stop();
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [showHours]);

    const next = data?.nextIso ? new Date(data.nextIso) : null;
    const prev = data?.previousIso ? new Date(data.previousIso) : null;

    const nextDate = next && next.getTime() > now.getTime() ? next : null;
    const remaining = nextDate ? Math.max(0, nextDate.getTime() - now.getTime()) : 0;

    // breakdown
    const totalSec = Math.floor(remaining / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);

    // Build parts with t() pluralization
    const parts: string[] = [];
    if (d > 0) parts.push(t("units.day", { count: d }));
    if (h > 0) parts.push(t("units.hour", { count: h }));
    // always include minutes to make it feel “live”
    if (m > 0 || (d === 0 && h === 0 && totalSec > 0)) {
        parts.push(t("units.minute", { count: m }));
    }
    const durationText = format.list(parts, { style: "long", type: "conjunction" });

    const daysSincePrev = prev
        ? Math.floor((now.getTime() - prev.getTime()) / (24 * 3600 * 1000))
        : null;

    const dateText =
        nextDate &&
        format.dateTime(nextDate, {
            dateStyle: "full",
            timeStyle: "short",
            // timeZone: "Europe/Oslo",
        });

    return (
        <div className="flex flex-col items-center gap-2 p-2 text-center">
            {nextDate ? (
                <>
                    <div className="text-[0.70rem] tracking-wide uppercase opacity-70">
                        {t("timeRemaining")}
                    </div>

                    <div className="text-3xl font-bold tabular-nums">{durationText}</div>

                    <div className="text-xs opacity-70">{dateText}</div>

                    {/* Simple progress bar (example: relative to 7 days) */}
                    <div className="mt-2 h-1 w-full rounded-full bg-black/10">
                        <div
                            className="h-1 rounded-full bg-black/30"
                            style={{
                                width: `${Math.max(
                                    0,
                                    100 - (remaining / (7 * 24 * 3600 * 1000)) * 100
                                )}%`,
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
