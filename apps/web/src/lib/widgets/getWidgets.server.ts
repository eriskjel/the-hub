import "server-only";
import { cookies } from "next/headers";
import type { AnyWidget } from "@/types/widgets/types";
import { toAnyWidget, type WidgetListItem } from "@/types/widgets/list";
import { resolveOrigin } from "@/utils/url";

const CACHE_KEY = "widgets_cache";

export type WidgetsResult = {
    widgets: AnyWidget[];
    rows?: WidgetListItem[];
    error?: string;
    stale?: boolean;
    offline?: boolean;
};

export async function getWidgets(): Promise<{ widgets: AnyWidget[]; rows: WidgetListItem[] }> {
    const origin = await resolveOrigin();
    const jar = await cookies();
    const cookieHeader = jar
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(`${origin}/api/widgets/list`, {
        cache: "no-store",
        headers: { cookie: cookieHeader },
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
            `Backend returned ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`
        );
    }

    const rows: WidgetListItem[] = await res.json();
    return { widgets: rows.map(toAnyWidget), rows };
}

async function readCachedWidgets(): Promise<{
    widgets: AnyWidget[];
    rows: WidgetListItem[];
    ageMs: number;
} | null> {
    try {
        const jar = await cookies();
        const raw = jar.get(CACHE_KEY)?.value;
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { ts: number; rows?: unknown; slim?: unknown };
        const rows = normalizeCachedToRows(parsed);
        if (!rows) return null;

        return {
            rows,
            widgets: rows.map(toAnyWidget),
            ageMs: Date.now() - parsed.ts,
        };
    } catch {
        return null;
    }
}

export async function getWidgetsSafe(): Promise<WidgetsResult> {
    try {
        const { widgets, rows } = await getWidgets(); // via proxy
        return { widgets, rows };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load widgets";
        const offline: boolean = isOfflineError(msg);

        const cached = await readCachedWidgets();
        if (cached) {
            return { widgets: cached.widgets, error: msg, stale: true, offline };
        }
        return { widgets: [], error: msg, stale: false, offline };
    }
}

function isOfflineError(msg: string): boolean {
    // Matches common network and backend errors indicating offline or unreachable backend.
    // Patterns include: timeout, connection failed, backend unreachable, fetch failed, network errors,
    // and typical Node.js error codes (ECONN, ENOTFOUND, EAI_AGAIN, 5xx HTTP status).
    return /(timed\s*out|connection\s*failed|backend_unreachable|fetch\s*failed|network|ECONN|ENOTFOUND|EAI_AGAIN|5\d\d)/i.test(
        msg
    );
}

function normalizeCachedToRows(payload: {
    rows?: unknown;
    slim?: unknown;
}): WidgetListItem[] | null {
    const arr = (Array.isArray(payload.slim) ? payload.slim : payload.rows) as unknown[];
    if (!Array.isArray(arr)) return null;

    // minimally validate + inflate to WidgetListItem (settings omitted -> undefined)
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
                // settings can be absent in slim; toAnyWidget provides safe defaults per kind
                settings: (o.settings ?? undefined) as unknown,
            });
        }
    }
    return rows.length ? rows : null;
}
