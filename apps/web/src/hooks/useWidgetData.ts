"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { DegradedError, HttpError } from "@/lib/widgets/fetchJson";
import {
    MIN_POLL_INTERVAL_MS,
    DEFAULT_WIDGET_DATA_INTERVAL_MS,
    MAX_RETRIES,
    BASE_RETRY_DELAY,
} from "@/utils/timers";
import { warnOnce } from "@/utils/warnOnce";

type State<D = unknown> =
    | { status: "loading" }
    | { status: "error"; error: string; retryCount: number }
    | { status: "success"; data: D; stale?: boolean };

export function useWidgetData<D = unknown>(
    widget: AnyWidget,
    intervalMs: number = DEFAULT_WIDGET_DATA_INTERVAL_MS,
    userId: string = "anon"
) {
    const kind = widget.kind;
    const entry = registry[widget.kind];

    const [state, setState] = useState<State<D>>({ status: "loading" });
    const inFlightRef = useRef(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // Namespace cache per widget instance
    const cacheKey = `hub:u:${userId ?? "anon"}:widget:${kind}:${widget.instanceId}`;

    const saveCache = useCallback(
        (data: unknown) => {
            try {
                const payload = JSON.stringify({ ts: Date.now(), data });
                localStorage.setItem(cacheKey, payload);
            } catch {
                // ignore quota/serialization errors
            }
        },
        [cacheKey]
    );

    const loadCache = useCallback(<T>(): { ts: number; data: T } | null => {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return null;
            return JSON.parse(raw) as { ts: number; data: T };
        } catch {
            return null;
        }
    }, [cacheKey]);

    const load = useCallback(
        async (retryCount = 0) => {
            const key = `${kind}:${widget.instanceId}`;

            if (!entry || typeof entry.fetch !== "function") {
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
                const data = (await entry.fetch(widget.instanceId)) as D;
                if (mountedRef.current) {
                    setState({ status: "success", data, stale: false });
                    saveCache(data);
                }
            } catch (err) {
                if (err instanceof DegradedError) {
                    const cached = loadCache<D>();
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
                    // Exponential backoff with slight jitter to de-sync retries
                    const jitter = 1 + Math.random() * 0.2; // +0–20%
                    const delay = Math.floor(BASE_RETRY_DELAY * 2 ** retryCount * jitter);
                    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                    retryTimeoutRef.current = setTimeout(() => load(retryCount + 1), delay);
                } else if (mountedRef.current) {
                    const cached = loadCache<D>();
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

        // Seed with any cached data to avoid empty UI
        const cached = loadCache<D>();
        if (cached) setState({ status: "success", data: cached.data, stale: true });

        // Kick off first load
        load();

        // Guard against negative/NaN intervals and hard-clamp a minimum
        const pollEvery = Math.max(
            MIN_POLL_INTERVAL_MS,
            Number.isFinite(intervalMs) ? Math.floor(intervalMs) : DEFAULT_WIDGET_DATA_INTERVAL_MS
        );
        const intervalId = pollEvery > 0 ? setInterval(() => load(), pollEvery) : null;

        return () => {
            mountedRef.current = false;
            if (intervalId) clearInterval(intervalId);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [load, intervalMs, loadCache]);

    return state;
}
