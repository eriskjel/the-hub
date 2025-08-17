"use client";

import { useEffect, useRef } from "react";
import { WidgetListItem } from "@/types/widgets/list";

export default function SeedWidgetsCacheWithRows({ rows }: { rows: WidgetListItem[] }) {
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current || !rows?.length) return;
        didRun.current = true;


        fetch("/api/widgets/seed", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ rows: rows }),
        }).catch(() => {});
    }, [rows]);

    return null;
}
