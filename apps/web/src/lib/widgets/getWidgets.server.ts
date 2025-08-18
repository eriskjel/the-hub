import "server-only";
import type { AnyWidget } from "@/widgets/schema";
import { toAnyWidget, type WidgetListItem } from "@/widgets/rows";
import { resolveOrigin } from "@/utils/url";
import { isOfflineError, makeForwardedCookieHeader } from "@/utils/http";
import { readWidgetsCookie } from "@/lib/widgets/cache.server";

export type WidgetsResult = {
    widgets: AnyWidget[];
    rows?: WidgetListItem[];
    error?: string;
    stale?: boolean;
    offline?: boolean;
};

export async function getWidgets(): Promise<{ widgets: AnyWidget[]; rows: WidgetListItem[] }> {
    const origin: string = await resolveOrigin();
    const cookieHeader: string = await makeForwardedCookieHeader();

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

export async function getWidgetsSafe(): Promise<WidgetsResult> {
    try {
        return await getWidgets();
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load widgets";
        const offline: boolean = isOfflineError(msg);
        const cached = await readWidgetsCookie();
        if (cached) {
            const widgets: AnyWidget[] = cached.rows.map(toAnyWidget);
            return { widgets, rows: cached.rows, error: msg, stale: true, offline };
        }
        return { widgets: [], error: msg, stale: false, offline };
    }
}
