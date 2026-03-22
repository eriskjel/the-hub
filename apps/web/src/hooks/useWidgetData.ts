"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnyWidget } from "@/widgets/schema";
import { registry } from "@/widgets";
import { DegradedError, HttpError } from "@/lib/widgets/fetchJson";
import {
    BASE_RETRY_DELAY,
    DEFAULT_WIDGET_DATA_INTERVAL_MS,
    MAX_RETRIES,
    MIN_POLL_INTERVAL_MS,
} from "@/utils/timers";

// Tracks when we first observed isEnriched:false per cache key.
// Cleaned up when enrichment completes or the 2-minute cap is hit.
const enrichmentStartTs = new Map<string, number>();
const ENRICHMENT_FAST_POLL_MS = 5_000;
const ENRICHMENT_MAX_WAIT_MS = 2 * 60 * 1_000;
import { queryKeys } from "@/lib/queryKeys";
import { warnOnce } from "@/utils/warnOnce";

function lsKey(userId: string, kind: string, instanceId: string) {
    return `hub:u:${userId}:widget:${kind}:${instanceId}`;
}

function readCache<T>(key: string, settingsSig: string): { ts: number; data: T } | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts: number; sig?: string; data: T };
        return parsed.sig === settingsSig ? { ts: parsed.ts, data: parsed.data } : null;
    } catch {
        return null;
    }
}

function writeCache(key: string, settingsSig: string, data: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), sig: settingsSig, data }));
    } catch {}
}

export function useWidgetData<D = unknown>(
    widget: AnyWidget,
    intervalMs: number = DEFAULT_WIDGET_DATA_INTERVAL_MS,
    userId: string = "anon"
) {
    const { kind, instanceId } = widget;
    const entry = registry[kind];
    const settingsSig = JSON.stringify(widget.settings ?? {});
    const cacheKey = lsKey(userId, kind, instanceId);

    const pollInterval = Math.max(
        MIN_POLL_INTERVAL_MS,
        Number.isFinite(intervalMs) ? Math.floor(intervalMs) : DEFAULT_WIDGET_DATA_INTERVAL_MS
    );

    const query = useQuery<D, Error>({
        queryKey: queryKeys.widget(userId, kind, instanceId, settingsSig),

        queryFn: async () => {
            if (!entry || typeof entry.fetch !== "function") {
                throw new Error(`Widget type "${kind}" is not supported`);
            }
            try {
                const data = (await entry.fetch(instanceId)) as D;
                writeCache(cacheKey, settingsSig, data);
                return data;
            } catch (err) {
                if (err instanceof DegradedError) {
                    const cached = readCache<D>(cacheKey, settingsSig);
                    if (cached) {
                        warnOnce(
                            `${kind}:${instanceId}`,
                            `[widget:${kind}:${instanceId}] degraded; using cached data`
                        );
                        return cached.data;
                    }
                    warnOnce(
                        `${kind}:${instanceId}`,
                        `[widget:${kind}:${instanceId}] degraded; no cache`
                    );
                }
                throw err;
            }
        },

        // Data is fresh for the duration of one poll cycle.
        // After that it becomes stale and the refetchInterval re-fetches it.
        staleTime: pollInterval,

        // Don't fetch during SSR — relative URLs aren't valid in Node.
        // Both server and client render isPending=true initially → skeleton shows → no mismatch.
        enabled: typeof window !== "undefined" && !!entry?.fetch,

        refetchInterval: (q) => {
            const err = q.state.error;
            if (err instanceof HttpError && err.status === 404) return false;

            const data = q.state.data as { isEnriched?: boolean } | unknown[] | undefined;
            if (
                data &&
                !Array.isArray(data) &&
                (data as { isEnriched?: boolean }).isEnriched === false
            ) {
                if (!enrichmentStartTs.has(cacheKey)) enrichmentStartTs.set(cacheKey, Date.now());
                const elapsed = Date.now() - enrichmentStartTs.get(cacheKey)!;
                if (elapsed < ENRICHMENT_MAX_WAIT_MS) return ENRICHMENT_FAST_POLL_MS;
                enrichmentStartTs.delete(cacheKey); // cap hit, give up
            } else {
                enrichmentStartTs.delete(cacheKey); // enriched, clean up
            }

            return pollInterval;
        },

        retry: (failureCount, err) => {
            if (err instanceof HttpError && err.status === 404) return false;
            return failureCount < MAX_RETRIES;
        },

        retryDelay: (attempt) => {
            const jitter = 1 + Math.random() * 0.2;
            return Math.floor(BASE_RETRY_DELAY * 2 ** attempt * jitter);
        },
    });

    // Clear localStorage on 404 (widget deleted from backend)
    useEffect(() => {
        if (query.error instanceof HttpError && (query.error as HttpError).status === 404) {
            try {
                localStorage.removeItem(cacheKey);
            } catch {}
        }
    }, [query.error, cacheKey]);

    return {
        data: query.data,
        isPending: query.isPending,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    };
}
