import { cookies } from "next/headers";
import type { WidgetListItem } from "@/widgets/rows";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const WIDGETS_CACHE_KEY = "widgets_cache";

export function normalizeCachedToRows(payload: {
    rows?: unknown;
    slim?: unknown;
}): WidgetListItem[] | null {
    const arr = (Array.isArray(payload.slim) ? payload.slim : payload.rows) as unknown[];
    if (!Array.isArray(arr)) return null;

    const rows: WidgetListItem[] = [];
    for (const w of arr) {
        if (!w || typeof w !== "object") continue;
        const o = w as Record<string, unknown>;
        if (
            typeof o.id === "string" &&
            typeof o.instanceId === "string" &&
            typeof o.kind === "string" &&
            typeof o.title === "string" &&
            typeof o.grid === "object" &&
            o.grid !== null
        ) {
            rows.push({
                id: o.id,
                instanceId: o.instanceId,
                kind: o.kind as WidgetListItem["kind"],
                title: o.title as string,
                grid: o.grid as WidgetListItem["grid"],
                settings: (o.settings ?? undefined) as unknown,
            });
        }
    }
    return rows.length ? rows : null;
}

export async function readWidgetsCookie(): Promise<{
    rows: WidgetListItem[];
    ageMs: number;
} | null> {
    const jar: ReadonlyRequestCookies = await cookies();
    const raw = jar.get(WIDGETS_CACHE_KEY)?.value;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as { ts: number; rows?: unknown; slim?: unknown };
        const rows: WidgetListItem[] | null = normalizeCachedToRows(parsed);
        if (!rows) return null;
        return { rows, ageMs: Date.now() - parsed.ts };
    } catch {
        return null;
    }
}
