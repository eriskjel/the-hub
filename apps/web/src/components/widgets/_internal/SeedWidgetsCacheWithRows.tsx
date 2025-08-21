"use client";

import { useEffect, useRef } from "react";
import { WidgetListItem } from "@/widgets/rows";
import { API } from "@/lib/apiRoutes";

export default function SeedWidgetsCacheWithRows({
    rows,
    userId,
}: {
    rows: WidgetListItem[];
    userId: string;
}) {
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

        fetch(API.widgets.seed, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ uid: userId, slim }),
        }).catch(() => {});
    }, [rows, userId]);

    return null;
}
