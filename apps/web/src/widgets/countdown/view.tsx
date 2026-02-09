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
    const t = useTranslations("widgets.countdown.view");
    const format = useFormatter();

    const hasNext = !!data?.nextIso;
    const hasPrev = !!data?.previousIso;

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

    // "upcoming" for copy
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
            setNow(new Date(Date.now() + skew)); // keep following server time with the same skew
        };

        tick(); // set immediately
        const id = window.setInterval(tick, intervalMs);

        const onVisible = () => {
            if (document.visibilityState === "visible") tick();
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
    if (m > 0 || (d === 0 && h === 0 && totalSec > 0)) parts.push(t("units.minute", { count: m }));
    const fullText =
        format.list(parts, { style: "long", type: "conjunction" }) + " " + t("units.left");

    // Split at locale-aware conjunction for potential line break (e.g. " and " / " og ")
    const conjunction = t("units.conjunction");
    const durationParts = fullText.split(conjunction);
    const hasMultipleParts = durationParts.length > 1;

    // Nice labels
    const whenText =
        hasNext &&
        format.dateTime(next!, { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Oslo" });

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
        // min-h ensures countdown fills the widget content area (matches grocery at 136px content)
        <div className="flex min-h-[136px] flex-1 flex-col text-center">
            {isOngoing || isUpcoming ? (
                <div className="flex min-h-0 flex-1 flex-col">
                    {/* top status pill only */}
                    <div className="mb-1 flex-none text-xs">
                        {isOngoing && (
                            <span className="bg-success/20 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                                    <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full"></span>
                                </span>
                                {t("status.ongoing")}
                            </span>
                        )}
                    </div>

                    {/* middle content - timer centered vertically, sublabel below */}
                    <div className="flex flex-1 flex-col items-center justify-center">
                        <div className="text-center text-2xl leading-tight font-bold tabular-nums">
                            {hasMultipleParts ? (
                                <>
                                    <span className="inline-block whitespace-nowrap">
                                        {durationParts[0].trimEnd()}
                                        {conjunction}
                                    </span>{" "}
                                    <span className="inline-block">
                                        {durationParts[1].trimStart()}
                                    </span>
                                </>
                            ) : (
                                <span className="whitespace-nowrap">{fullText}</span>
                            )}
                        </div>
                        <div className="mt-2 text-xs opacity-70">
                            {isOngoing
                                ? whenText && t("status.endsAt", { when: whenText })
                                : whenText && t("status.startsAt", { when: whenText })}
                        </div>
                    </div>

                    {/* bottom progress bar (only when ongoing) */}
                    {isOngoing && (
                        <div className="bg-success/20 mt-auto h-1.5 w-full flex-none rounded-full">
                            <div
                                className="bg-success h-1.5 rounded-full shadow-[0_0_4px_rgba(5,150,105,0.4)] transition-all duration-300 ease-out"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    )}
                </div>
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
