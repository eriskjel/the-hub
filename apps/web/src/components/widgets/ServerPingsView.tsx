"use client";

import type { PingsData, PingsRow } from "@/types/widgets/data";
import { ReactElement } from "react";

export default function ServerPingsView({ data }: { data: PingsData }): ReactElement {
    return (
        <div className="rounded-2xl bg-neutral-900 p-4 text-neutral-100">
            <div className="mb-3 text-sm text-neutral-400">
                Updated {new Date(data.updatedAt).toLocaleTimeString()}
            </div>
            <ul className="space-y-2">
                {data.data.map((row: PingsRow) => (
                    <li
                        key={row.url}
                        className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2"
                    >
                        <span className="max-w-[60%] truncate">{row.url}</span>
                        <span className="text-sm tabular-nums">
                            <span
                                className={`mr-3 ${row.status >= 200 && row.status < 400 ? "text-green-400" : "text-red-400"}`}
                            >
                                {row.status}
                            </span>
                            {row.ms} ms
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
