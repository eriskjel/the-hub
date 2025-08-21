"use client";

import type { PingsData, PingsRow } from "@/widgets/server-pings/types";
import { ReactElement } from "react";

export default function ServerPingsView({ data }: { data: PingsData }): ReactElement {
    const updated = new Date(data.updatedAt);
    const updatedStr = updated.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });

    return (
        <div>
            {/* subtle header, no heavy backgrounds */}
            <div className="mb-2 text-xs text-white/70">Oppdatert {updatedStr}</div>

            <ul className="divide-y divide-white/10">
                {data.data.map((row: PingsRow) => {
                    const { host, path } = toParts(row.url);
                    const cls = statusClasses(row.status);

                    return (
                        <li key={row.url} className="flex items-center justify-between gap-3 py-2">
                            {/* left: status dot + host/path */}
                            <div className="flex min-w-0 items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${cls.dot}`} />
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white/90">
                                        {host}
                                    </div>
                                    {path ? (
                                        <div className="truncate text-xs text-white/60">{path}</div>
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
                                    className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/85 tabular-nums"
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

function statusClasses(code: number) {
    if (code >= 200 && code < 300) {
        return {
            dot: "bg-emerald-400",
            badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        };
    }
    if (code >= 300 && code < 400) {
        return {
            dot: "bg-sky-400",
            badge: "border-sky-400/25 bg-sky-400/10 text-sky-200",
        };
    }
    if (code >= 400 && code < 500) {
        return {
            dot: "bg-amber-400",
            badge: "border-amber-400/25 bg-amber-400/10 text-amber-200",
        };
    }
    // 5xx / error
    return {
        dot: "bg-rose-400",
        badge: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    };
}
