import { cookies } from "next/headers";
import type { WidgetListItem } from "@/widgets/rows";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const WIDGETS_CACHE_KEY = "widgets_cache";

export function widgetsCookieKeyFor(uid: string) {
    return `${WIDGETS_CACHE_KEY}_${uid}`;
}

/**
 * Shape persisted in the cookie. We support two payload forms:
 *  - "rows": full array of WidgetListItem-like objects
 *  - "slim": minimal array (id, instanceId, kind, title, grid)
 *    (settings may be omitted for "slim")
 */
type WidgetsCachePayload = {
    ts: number; // epoch millis of when the cookie was written
    rows?: unknown; // optional full rows
    slim?: unknown; // optional slim form (preferred)
};

/** Narrow an unknown value into a minimal "slim" row */
function isSlimRow(x: unknown): x is {
    id: string;
    instanceId: string;
    kind: WidgetListItem["kind"];
    title: string;
    grid: WidgetListItem["grid"];
    settings?: unknown;
} {
    if (typeof x !== "object" || x === null) return false;

    const obj = x as Record<string, unknown>;
    return (
        typeof obj.id === "string" &&
        typeof obj.instanceId === "string" &&
        typeof obj.kind === "string" &&
        typeof obj.title === "string" &&
        typeof obj.grid === "object" &&
        obj.grid !== null
    );
}

/**
 * Convert parsed cookie JSON into strongly-typed rows.
 * Accepts either "slim" or "rows" arrays; ignores invalid entries.
 * Returns null if nothing usable is found.
 */
export function normalizeCachedToRows(payload: {
    rows?: unknown;
    slim?: unknown;
}): WidgetListItem[] | null {
    const candidate = Array.isArray(payload.slim)
        ? (payload.slim as unknown[])
        : Array.isArray(payload.rows)
          ? (payload.rows as unknown[])
          : null;

    if (!candidate) return null;

    const rows: WidgetListItem[] = [];
    for (const item of candidate) {
        if (!isSlimRow(item)) continue;

        rows.push({
            id: item.id,
            instanceId: item.instanceId,
            kind: item.kind,
            title: item.title,
            grid: item.grid,
            // settings can be absent in "slim"; the consumer (toAnyWidget) will fill defaults per kind
            settings: item.settings ?? undefined,
        });
    }

    return rows.length ? rows : null;
}

/**
 * Read and parse the widgets cache cookie for a specific user.
 * Returns typed rows and cookie age (ms) if present; otherwise null.
 */
export async function readWidgetsCookie(currentUid: string | null): Promise<{
    rows: WidgetListItem[];
    ageMs: number;
} | null> {
    if (!currentUid) return null;

    const jar: ReadonlyRequestCookies = await cookies();
    const raw = jar.get(widgetsCookieKeyFor(currentUid))?.value;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as WidgetsCachePayload;
        const rows = normalizeCachedToRows(parsed);
        if (!rows) return null;
        return { rows, ageMs: Date.now() - parsed.ts };
    } catch {
        return null;
    }
}

export async function writeWidgetsCookieServer(uid: string, rows: WidgetListItem[]) {
    const slim = rows.map(({ id, instanceId, kind, title, grid }) => ({
        id,
        instanceId,
        kind,
        title,
        grid,
    }));

    const jar = await cookies();
    jar.set(widgetsCookieKeyFor(uid), JSON.stringify({ ts: Date.now(), slim, v: 1 }), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === "production",
    });
}
