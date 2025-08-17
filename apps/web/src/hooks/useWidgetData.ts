"use client";

import { useEffect, useState } from "react";
import type { AnyWidget } from "@/types/widgets/types";
import { registry } from "@/lib/widgets/registry";

type State<D = any> =
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "success"; data: D };

export function useWidgetData(widget: AnyWidget, intervalMs = 30_000) {
    const entry = registry[widget.kind as keyof typeof registry];
    const [state, setState] = useState<State>({ status: "loading" });

    useEffect(() => {
        if (!entry) {
            setState({ status: "error", error: `Unknown widget kind: ${widget.kind}` });
            return;
        }
        let dead = false;

        const load = () =>
            entry
                .fetch(widget.instanceId)
                .then((d) => !dead && setState({ status: "success", data: d }))
                .catch((e) => {
                    // keep the detailed error for devs, show a friendly one to users
                    console.error(`[widget:${widget.kind}] fetch failed`, e);
                    if (!dead) {
                        setState({
                            status: "error",
                            error: "Couldn’t reach the service. Try again shortly.",
                        });
                    }
                });

        load();
        const id = intervalMs > 0 ? setInterval(load, intervalMs) : null;
        return () => {
            dead = true;
            if (id) clearInterval(id);
        };
    }, [widget.kind, widget.instanceId, intervalMs]);

    return state;
}
