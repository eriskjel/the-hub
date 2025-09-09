"use client";

import { useEffect, useMemo, useRef } from "react";
import { WidgetListItem } from "@/widgets/rows";
import { API } from "@/lib/apiRoutes";

export default function SeedWidgetsCacheWithRows({ rows }: { rows: WidgetListItem[] }) {
    // build a stable signature from instanceIds; order-insensitive
    const sig = useMemo(
        () =>
            rows
                .map((r) => r.instanceId)
                .sort()
                .join("|"),
        [rows]
    );
    const lastSig = useRef<string | null>(null);

    useEffect(() => {
        if (!rows?.length) return;
        if (sig === lastSig.current) return;
        lastSig.current = sig;

        const slim = rows.map(({ id, instanceId, kind, grid }) => ({
            id,
            instanceId,
            kind,
            grid,
        }));

        fetch(API.widgets.seed, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slim }),
            credentials: "same-origin",
        }).catch(() => {});
    }, [sig, rows]);

    return null;
}
