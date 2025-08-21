"use client";

import type { PingsData, PingsRow } from "@/widgets/server-pings/types";
import { ReactElement } from "react";

export default function ServerPingsView({ data }: { data: PingsData }): ReactElement {
    const updated = new Date(data.updatedAt);
    const updatedStr = updated.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });

    return (
        <div>
            {/* subtle header */}
            <div className="mb-2 text-xs text-neutral-600">Oppdatert {updatedStr}</div>

            <ul className="divide-y divide-neutral-200">
                {data.data.map((row: PingsRow) => {
                    const { host, path } = toParts(row.url);
                    const cls = statusClasses(row.status);

                    return (
                        <li key={row.url} className="flex items-center justify-between gap-3 py-2">
                            {/* left: status dot + host/path */}
                            <div className="flex min-w-0 items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${cls.dot}`} />
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-neutral-900">
                                        {host}
                                    </div>
                                    {path ? (
                                        <div className="truncate text-xs text-neutral-600">
                                            {path}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* right: status + latency pills */}
                            <div className="flex shrink-0 items-center gap-2">
                                <span
                                    className={`rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${cls.badge}`}
                                    title={`HTTP ${row.status}`}
                                >
                                    {row.status}
                                </span>
                                <span
                                    className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-800 tabular-nums"
                                    title="Latency"
                                >
                                    {row.ms} ms
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function toParts(url: string): { host: string; path: string } {
    try {
        const u = new URL(url);
        const path = u.pathname + (u.search || "");
        return { host: u.hostname, path: path === "/" ? "" : path };
    } catch {
        return { host: url, path: "" };
    }
}

/**
 * Tailwind classes tuned for a LIGHT (white) surface:
 * - dot: saturated solid for quick status scan
 * - badge: very light tinted bg + subtle border + darker text for contrast
 */
function statusClasses(code: number) {
    if (code >= 200 && code < 300) {
        return {
            dot: "bg-emerald-500",
            badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        };
    }
    if (code >= 300 && code < 400) {
        return {
            dot: "bg-sky-500",
            badge: "border-sky-200 bg-sky-50 text-sky-700",
        };
    }
    if (code >= 400 && code < 500) {
        return {
            dot: "bg-amber-500",
            badge: "border-amber-200 bg-amber-50 text-amber-800",
        };
    }
    // 5xx / error
    return {
        dot: "bg-rose-500",
        badge: "border-rose-200 bg-rose-50 text-rose-700",
    };
}
