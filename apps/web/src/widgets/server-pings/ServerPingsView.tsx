"use client";

import type { PingsData, PingsRow } from "@/widgets/server-pings/types";
import { ReactElement } from "react";

export default function ServerPingsView({
    data,
}: {
    data: PingsData | null | undefined;
}): ReactElement {
    if (!data || !Array.isArray(data.data)) {
        return <div className="text-muted p-3 text-sm">No ping data available</div>;
    }

    const updated = new Date(data.updatedAt ?? Date.now());
    const updatedStr = updated.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });

    if (data.data.length === 0) {
        return (
            <div>
                <div className="text-muted mb-2 text-xs">Oppdatert {updatedStr}</div>
                <div className="text-muted p-3 text-sm">Ingen endepunkter å vise</div>
            </div>
        );
    }

    return (
        <div>
            <div className="text-muted mb-2 text-xs">Oppdatert {updatedStr}</div>
            <ul className="divide-border divide-y">
                {data.data.map((row: PingsRow) => {
                    const { host, path } = toParts(row.url);
                    const cls = statusClasses(row.status);
                    return (
                        <li key={row.url} className="flex items-center justify-between gap-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${cls.dot}`} />
                                <div className="min-w-0">
                                    <div className="text-foreground truncate text-sm font-medium">
                                        {host}
                                    </div>
                                    {path ? (
                                        <div className="text-muted truncate text-xs">{path}</div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span
                                    className={`rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${cls.badge}`}
                                    title={`HTTP ${row.status}`}
                                >
                                    {row.status}
                                </span>
                                <span
                                    className="border-border bg-surface-subtle text-foreground rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums"
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
    if (code >= 200 && code < 300)
        return {
            dot: "bg-success",
            badge: "border-success-subtle bg-success-subtle text-success",
        };
    if (code >= 300 && code < 400)
        return { dot: "bg-info", badge: "border-info-subtle bg-info-subtle text-info" };
    if (code >= 400 && code < 500)
        return {
            dot: "bg-status-error",
            badge: "border-status-error-subtle bg-status-error-subtle text-status-error",
        };
    return {
        dot: "bg-error",
        badge: "border-error-subtle bg-error-subtle text-error",
    };
}
