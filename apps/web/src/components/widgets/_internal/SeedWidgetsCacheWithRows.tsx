"use client";

import { useEffect, useMemo, useRef } from "react";
import { WidgetListItem } from "@/widgets/rows";
import { API } from "@/lib/apiRoutes";

export default function SeedWidgetsCacheWithRows({ rows }: { rows: WidgetListItem[] }) {
    // build a stable signature from instanceIds; order-insensitive
    const sig = useMemo(
        () =>
            JSON.stringify(
                rows.map((r) => ({ id: r.id, instanceId: r.instanceId, title: r.title }))
            ),
        [rows]
    );
    const lastSig = useRef<string | null>(null);

    useEffect(() => {
        if (!rows?.length) return;
        if (sig === lastSig.current) return;
        lastSig.current = sig;

        const slim = rows.map(({ id, instanceId, kind, title, grid }) => ({
            id,
            instanceId,
            kind,
            title,
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
