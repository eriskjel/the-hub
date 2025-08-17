"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyWidget } from "@/types/widgets/types";
import { registry } from "@/lib/widgets/registry";
import { DegradedError, HttpError } from "@/lib/widgets/fetchJson";

type State<D = unknown> =
    | { status: "loading" }
    | { status: "error"; error: string; retryCount: number }
    | { status: "success"; data: D; stale?: boolean };

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

const lastWarn = new Map<string, number>();
const warnOnce = (key: string, msg: string) => {
    const now = Date.now();
    if ((lastWarn.get(key) ?? 0) + 60_000 < now) {
        console.warn(msg);
        lastWarn.set(key, now);
    }
};

export function useWidgetData(widget: AnyWidget, intervalMs = 30_000) {
    const kind = widget.kind;
    const entry = kind === "server-pings" ? registry["server-pings"] : undefined;

    const [state, setState] = useState<State>({ status: "loading" });
    const inFlightRef = useRef(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const cacheKey = `hub:widget:${kind}:${widget.instanceId}`;

    const saveCache = useCallback(
        (data: unknown) => {
            try {
                const payload = JSON.stringify({ ts: Date.now(), data });
                localStorage.setItem(cacheKey, payload);
            } catch {}
        },
        [cacheKey]
    );

    const loadCache = useCallback(<D>(): { ts: number; data: D } | null => {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return null;
            return JSON.parse(raw) as { ts: number; data: D };
        } catch {
            return null;
        }
    }, [cacheKey]);

    const load = useCallback(
        async (retryCount = 0) => {
            const key = `${kind}:${widget.instanceId}`;

            if (!entry) {
                setState({
                    status: "error",
                    error: `Widget type "${kind}" is not supported`,
                    retryCount: 0,
                });
                return;
            }
            if (inFlightRef.current) return;
            inFlightRef.current = true;

            try {
                const data = await entry.fetch(widget.instanceId);
                if (mountedRef.current) {
                    setState({ status: "success", data, stale: false });
                    saveCache(data);
                }
            } catch (err) {
                if (err instanceof DegradedError) {
                    const cached = loadCache();
                    if (cached && mountedRef.current) {
                        setState({ status: "success", data: cached.data, stale: true });
                        warnOnce(key, `[widget:${key}] degraded; using cached data`);
                        inFlightRef.current = false;
                        return;
                    }
                    if (mountedRef.current) {
                        setState({
                            status: "error",
                            error: "Service temporarily unavailable",
                            retryCount,
                        });
                        warnOnce(key, `[widget:${key}] degraded; no cache`);
                    }
                    inFlightRef.current = false;
                    // No backoff in degraded mode; rely on interval tick
                    return;
                }

                const msg =
                    err instanceof HttpError
                        ? `${err.status} ${JSON.stringify(err.body)}`
                        : err instanceof Error
                          ? err.message
                          : String(err);
                warnOnce(key, `[widget:${key}] fetch failed: ${msg}`);

                if (retryCount < MAX_RETRIES && mountedRef.current) {
                    const delay = BASE_RETRY_DELAY * 2 ** retryCount;
                    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                    retryTimeoutRef.current = setTimeout(() => load(retryCount + 1), delay);
                } else if (mountedRef.current) {
                    const cached = loadCache();
                    if (cached) {
                        setState({ status: "success", data: cached.data, stale: true });
                    } else {
                        setState({
                            status: "error",
                            error: "Service temporarily unavailable",
                            retryCount,
                        });
                    }
                }
            } finally {
                inFlightRef.current = false;
            }
        },
        [entry, kind, widget.instanceId, loadCache, saveCache]
    );

    useEffect(() => {
        mountedRef.current = true;

        const cached = loadCache();
        if (cached) setState({ status: "success", data: cached.data, stale: true });

        load();

        const intervalId = intervalMs > 0 ? setInterval(() => load(), intervalMs) : null;
        return () => {
            mountedRef.current = false;
            if (intervalId) clearInterval(intervalId);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [load, intervalMs, loadCache]);

    return state;
}
