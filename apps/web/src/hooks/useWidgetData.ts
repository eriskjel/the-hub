"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { DegradedError, HttpError } from "@/lib/widgets/fetchJson";
import {
    BASE_RETRY_DELAY,
    DEFAULT_WIDGET_DATA_INTERVAL_MS,
    MAX_RETRIES,
    MIN_POLL_INTERVAL_MS,
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

    const settingsSig = JSON.stringify(widget.settings ?? {});

    const [state, setState] = useState<State<D>>({ status: "loading" });
    const inFlightRef = useRef(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cacheKey = `hub:u:${userId ?? "anon"}:widget:${kind}:${widget.instanceId}`;

    const saveCache = useCallback(
        (data: unknown) => {
            try {
                const payload = JSON.stringify({ ts: Date.now(), sig: settingsSig, data });
                localStorage.setItem(cacheKey, payload);
            } catch {}
        },
        [cacheKey, settingsSig]
    );

    const loadCache = useCallback(<T>(): { ts: number; data: T } | null => {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { ts: number; sig?: string; data: T };
            return parsed.sig === settingsSig ? { ts: parsed.ts, data: parsed.data as T } : null;
        } catch {
            return null;
        }
    }, [cacheKey, settingsSig]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
    }, []);

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
                if (err instanceof HttpError && err.status === 404) {
                    console.warn("[useWidgetData] 404 stop", kind, widget.instanceId);
                    stopPolling();
                    try {
                        localStorage.removeItem(cacheKey);
                    } catch {}
                    if (mountedRef.current)
                        setState({ status: "error", error: "deleted", retryCount });
                    inFlightRef.current = false;
                    return;
                }

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
                    const jitter = 1 + Math.random() * 0.2;
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
        [entry, kind, widget.instanceId, loadCache, saveCache, stopPolling, cacheKey]
    );

    useEffect(() => {
        mountedRef.current = true;

        const cached = loadCache<D>();
        if (cached) setState({ status: "success", data: cached.data, stale: true });

        load();

        const pollEvery = Math.max(
            MIN_POLL_INTERVAL_MS,
            Number.isFinite(intervalMs) ? Math.floor(intervalMs) : DEFAULT_WIDGET_DATA_INTERVAL_MS
        );
        intervalRef.current = pollEvery > 0 ? setInterval(() => load(), pollEvery) : null;

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [load, intervalMs, loadCache]);

    return { state, refetch: load };
}
