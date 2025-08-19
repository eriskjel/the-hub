import "server-only";

import type { AnyWidget } from "@/widgets/schema";
import { toAnyWidget, type WidgetListItem } from "@/widgets/rows";
import { resolveOrigin } from "@/utils/url";
import { isOfflineError, makeForwardedCookieHeader } from "@/utils/http";
import { readWidgetsCookie } from "@/lib/widgets/cache.server";
import { API } from "@/lib/apiRoutes";

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

    const res = await fetch(`${origin}${API.widgets.list}`, {
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

export async function getWidgetsSafe(userId: string | null): Promise<WidgetsResult> {
    try {
        const { widgets, rows } = await getWidgets();
        return { widgets, rows };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load widgets";
        const offline = isOfflineError(msg);

        if (userId) {
            const cached = await readWidgetsCookie(userId);
            if (cached) {
                const rows = cached.rows;
                const widgets = rows.map(toAnyWidget);
                return { widgets, rows, error: msg, stale: true, offline }; // stale fallback
            }
        }

        // No cache or userId: return an empty + error envelope
        return { widgets: [], error: msg, stale: false, offline };
    }
}
