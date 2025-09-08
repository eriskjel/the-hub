"use client";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountdownWidget } from "@/widgets/schema";
import { CountdownData } from "@/widgets/countdown/types";
import { useTranslations } from "next-intl";

function parseTime(t: string) {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    return { h, m };
}

const weekdayIdx = (w: string) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(w);

function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
}

function nthWeekdayOfMonth(
    y: number,
    m: number,
    weekday: number,
    n: number,
    h: number,
    mm: number
) {
    const dates: Date[] = [];
    const d = new Date(y, m, 1, h, mm, 0, 0);
    while (d.getMonth() === m) {
        if (d.getDay() === weekday) dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return n > 0 ? (dates[n - 1] ?? null) : (dates[dates.length + n] ?? null);
}

function nextFromMonthlyRule(now: Date, s: CountdownWidget["settings"]): Date | null {
    if (s.source !== "monthly-rule") return null;
    const { time, dayOfMonth, byWeekday, bySetPos } = s;
    const { h, m } = parseTime(time);

    const y = now.getFullYear();
    const mo = now.getMonth();

    let candidate: Date | null = null;

    if (typeof dayOfMonth === "number") {
        const dom = Math.min(dayOfMonth, daysInMonth(y, mo));
        candidate = new Date(y, mo, dom, h, m, 0, 0);
    } else if (byWeekday && typeof bySetPos === "number") {
        const wd = weekdayIdx(byWeekday);
        if (wd < 0) return null;
        candidate = nthWeekdayOfMonth(y, mo, wd, bySetPos, h, m);
    } else {
        return null;
    }

    if (!candidate || candidate <= now) {
        const y2 = mo === 11 ? y + 1 : y;
        const mo2 = (mo + 1) % 12;
        if (typeof dayOfMonth === "number") {
            const dom2 = Math.min(dayOfMonth, daysInMonth(y2, mo2));
            candidate = new Date(y2, mo2, dom2, h, m, 0, 0);
        } else if (byWeekday && typeof bySetPos === "number") {
            const wd = weekdayIdx(byWeekday);
            candidate = wd < 0 ? null : nthWeekdayOfMonth(y2, mo2, wd, bySetPos, h, m);
        }
    }
    return candidate;
}

function computeNext(now: Date, w: CountdownWidget): Date | null {
    const s = w.settings;

    if (s.source === "fixed-date") {
        const d = new Date(s.targetIso);
        return isNaN(+d) ? null : d;
    }
    if (s.source === "monthly-rule") {
        return nextFromMonthlyRule(now, s);
    }
    if (s.source === "provider") {
        // With backend: use fetched data (if you wire fetch), otherwise no date on client
        return null;
    }
    return null;
}

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

    const [now, setNow] = useState<Date>(new Date());
    const tickRef = useRef<number | null>(null);

    useEffect(() => {
        tickRef.current = window.setInterval(() => setNow(new Date()), 1000);
        return () => {
            if (tickRef.current) window.clearInterval(tickRef.current);
        };
    }, []);

    const label = useMemo(() => {
        if (widget.settings.source === "provider") {
            const id = widget.settings.provider;
            if (id === "trippel-trumf") return t("providerNames.trippelTrumf");
            if (id === "dnb-supertibud") return t("providerNames.dnbSupertibud");
        }
        return widget.title;
    }, [t, widget]);

    const next = data?.nextIso ? new Date(data.nextIso) : null;
    const prev = data?.previousIso ? new Date(data.previousIso) : null;

    const nextDate = next && next.getTime() > now.getTime() ? next : null;

    const remaining = nextDate ? nextDate.getTime() - now.getTime() : 0;
    const daysSincePrev = prev
        ? Math.floor((now.getTime() - prev.getTime()) / (24 * 3600 * 1000))
        : null;

    return (
        <div className="flex flex-col items-center gap-2 p-2 text-center">
            <div className="text-xs tracking-wide uppercase opacity-70">{label}</div>

            {nextDate ? (
                <>
                    <div className="text-3xl font-bold tabular-nums">
                        {fmtRemain(remaining, widget.settings.showHours ?? true)}
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
