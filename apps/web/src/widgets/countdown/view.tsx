"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { CountdownWidget } from "@/widgets/schema";
import { CountdownData } from "@/widgets/countdown/types";
import { useFormatter, useTranslations } from "next-intl";

export default function CountdownView({
    widget,
    data,
}: {
    widget: CountdownWidget;
    data: CountdownData;
}): ReactElement {
    const hasNext = !!data?.nextIso;
    const hasPrev = !!data?.previousIso;

    const t = useTranslations("widgets.countdown.view");
    const format = useFormatter();

    // server-aligned clock (avoid client skew)
    const serverNow = data?.nowIso ? new Date(data.nowIso) : null;
    const [now, setNow] = useState<Date>(serverNow ?? new Date());
    useEffect(() => {
        if (serverNow) setNow(serverNow);
        // run once per payload change
    }, [serverNow?.getTime()]);

    // parse bounds
    const next = data?.nextIso ? new Date(data.nextIso) : null; // end when ongoing, start otherwise
    const prev = data?.previousIso ? new Date(data.previousIso) : null;

    // prefer backend ongoing; fallback to computed if missing
    const computedOngoing =
        !!next && !!prev && prev.getTime() <= now.getTime() && now.getTime() <= next.getTime();

    const isOngoing = typeof data?.ongoing === "boolean" ? data.ongoing : computedOngoing;

    // "upcoming" for copy (optional; you can also drive this from backend later)
    const isUpcoming =
        !!next &&
        next.getTime() > now.getTime() &&
        (!prev || prev.getTime() <= now.getTime()) &&
        !isOngoing;

    // decide tick granularity:
    // - showHours true + ongoing -> 1s
    // - otherwise -> 60s
    const showHours = widget.settings.showHours ?? true;
    const needsSecondTick = showHours && isOngoing;

    // compute skew once so our local clock tracks server time
    const initialServerMs = serverNow ? serverNow.getTime() : Date.now();
    const [skew] = useState<number>(initialServerMs - Date.now());

    // ticking
    useEffect(() => {
        const intervalMs = needsSecondTick ? 1000 : 60_000;

        const tick = () => {
            // keep following server time with the same skew
            setNow(new Date(Date.now() + skew));
        };

        tick(); // set immediately
        const id = window.setInterval(tick, intervalMs);

        const onVisible = () => {
            if (document.visibilityState === "visible") {
                tick();
            }
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [needsSecondTick, skew]);

    // For countdown target: if ongoing, we count down to end (next); if upcoming, count down to start (next)
    const target = hasNext ? next! : null;

    // Remaining to target (only if we actually have a future instant)
    const remaining =
        target && target.getTime() > now.getTime() ? target.getTime() - now.getTime() : 0;

    // breakdown
    const totalSec = Math.max(0, Math.floor(remaining / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);

    // Build parts with t() pluralization
    const parts: string[] = [];
    if (d > 0) parts.push(t("units.day", { count: d }));
    if (h > 0) parts.push(t("units.hour", { count: h }));
    if (m > 0 || (d === 0 && h === 0 && totalSec > 0)) {
        parts.push(t("units.minute", { count: m }));
    }
    const durationText = format.list(parts, { style: "long", type: "conjunction" });

    // Nice labels
    const endsAtText = hasNext
        ? format.dateTime(next!, { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Oslo" })
        : null;
    const startsAtText = endsAtText;

    // Progress bar: only meaningful when ongoing (prev..next window span)
    let progressPct = 0;
    if (isOngoing && hasPrev && hasNext) {
        const total = next!.getTime() - prev!.getTime();
        const elapsed = now.getTime() - prev!.getTime();
        progressPct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    }

    // Days since previous (for "not announced" fallback)
    const daysSincePrev = hasPrev
        ? Math.floor((now.getTime() - prev!.getTime()) / (24 * 3600 * 1000))
        : null;

    return (
        <div className="flex flex-1 flex-col p-2 text-center">
            {isOngoing || isUpcoming ? (
                <>
                    {/* top status pill only */}
                    <div className="mb-1 text-xs">
                        {isOngoing && (
                            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                                {t("status.ongoing")}
                            </span>
                        )}
                    </div>

                    {/* middle content */}
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="text-2xl font-bold tabular-nums">{durationText}</div>

                        {/* sublabel under countdown (small gray) */}
                        <div className="text-xs opacity-70">
                            {isOngoing
                                ? endsAtText && t("status.endsAt", { when: endsAtText })
                                : startsAtText && t("status.startsAt", { when: startsAtText })}
                        </div>
                    </div>

                    {/* bottom progress bar (only when ongoing) */}
                    {isOngoing && (
                        <div className="mt-auto h-1 w-full rounded-full bg-black/10">
                            <div
                                className="h-1 rounded-full bg-black/30"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    )}
                </>
            ) : (
                // Fallback: no future target known (backend gave no nextIso)
                <div className="flex flex-1 items-center justify-center text-xs opacity-70">
                    {hasPrev
                        ? t("nextNotAnnouncedWithDays", { days: daysSincePrev ?? 0 })
                        : t("nextNotAnnounced")}
                </div>
            )}
        </div>
    );
}
