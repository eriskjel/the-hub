"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { WidgetListItem } from "@/widgets/rows";
import { API } from "@/lib/apiRoutes";

type SlimWidget = Pick<WidgetListItem, "id" | "instanceId" | "kind" | "grid">;

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

    const { mutate } = useMutation({
        mutationFn: (slim: SlimWidget[]) =>
            fetch(API.widgets.seed, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ slim }),
                credentials: "same-origin",
            }),
    });

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

        mutate(slim);
    }, [sig, rows, mutate]);

    return null;
}
