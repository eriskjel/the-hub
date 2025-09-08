"use client";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountdownWidget } from "@/widgets/schema";
import { CountdownData } from "@/widgets/countdown/types";

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
    if (ms <= 0) return "0d 00:00";
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
    const [now, setNow] = useState<Date>(new Date());

    const tickRef = useRef<number | null>(null);

    useEffect(() => {
        tickRef.current = window.setInterval(() => setNow(new Date()), 1000);
        return () => {
            if (tickRef.current) window.clearInterval(tickRef.current);
        };
    }, []);

    const next = useMemo(() => {
        if (data?.nextIso) return new Date(data.nextIso);
        return computeNext(now, widget);
    }, [data?.nextIso, now, widget]);
    const remaining = next ? Math.max(0, +next - +now) : 0;

    const label = useMemo(() => {
        if (widget.settings.source === "provider") {
            const map: Record<string, string> = {
                "trippel-trumf": "Trippel-Trumf",
                "dnb-supertibud": "DNB Supertilbud",
            };
            return map[widget.settings.provider] ?? widget.title;
        }
        return widget.title;
    }, [widget]);

    return (
        <div className="flex flex-col items-center gap-2 p-2 text-center">
            <div className="text-xs tracking-wide uppercase opacity-70">{label}</div>
            <div className="text-3xl font-bold tabular-nums">
                {fmtRemain(remaining, widget.settings.showHours ?? true)}
            </div>
            <div className="text-xs opacity-70">
                {next
                    ? next.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })
                    : "No date"}
            </div>
            {remaining > 0 && (
                <div className="mt-2 h-1 w-full rounded-full bg-black/10">
                    <div
                        className="h-1 rounded-full bg-black/30"
                        style={{
                            width: `${Math.max(0, 100 - (remaining / (7 * 24 * 3600 * 1000)) * 100)}%`,
                        }}
                    />
                </div>
            )}
        </div>
    );
}
