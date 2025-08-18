"use client";

import { useEffect, useRef } from "react";
import { WidgetListItem } from "@/widgets/rows";

export default function SeedWidgetsCacheWithRows({ rows }: { rows: WidgetListItem[] }) {
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current || !rows?.length) return;
        didRun.current = true;

        const slim = rows.map(({ id, instanceId, kind, title, grid }) => ({
            id,
            instanceId,
            kind,
            title,
            grid,
        }));

        fetch("/api/widgets/seed", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slim }),
        }).catch(() => {});
    }, [rows]);

    return null;
}
