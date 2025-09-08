import "server-only";

import type { AnyWidget } from "@/widgets/schema";
import { toAnyWidget, type WidgetListItem } from "@/widgets/rows";
import { resolveOrigin } from "@/utils/url";
import { isOfflineError } from "@/utils/http";
import { readWidgetsCookie, writeWidgetsCookieServer } from "@/lib/widgets/cache.server";
import { API } from "@/lib/apiRoutes";
import { makeForwardedCookieHeader } from "@/utils/httpServer";
import { getCurrentUserAndProfile } from "@/lib/auth/getProfile.server";

/**
 * Fetch widgets fast (no uid), then:
 * - if success: seed cookie (if uid) and return network result
 * - if error: try per-user cookie and return { stale: true } if present
 */
export async function getDashboardWidgets(
    userPromise: ReturnType<typeof getCurrentUserAndProfile>
): Promise<WidgetsResult> {
    const networkWidgetsPromise = getWidgetsSafe(null);
    const [net, { user }] = await Promise.all([networkWidgetsPromise, userPromise]);
    const uid = user?.id ?? null;

    // Success (even empty list): optionally seed cookie and return network result
    if (!net.error) {
        if (uid && net.rows?.length) {
            try {
                await writeWidgetsCookieServer(uid, net.rows);
            } catch {}
        }
        return net;
    }

    // Degraded: try per-user cookie fallback
    if (!uid) return net;

    const cached = await readWidgetsCookie(uid);
    if (!cached?.rows?.length) return net;

    const rows = cached.rows;
    return {
        widgets: rows.map(toAnyWidget),
        rows,
        error: net.error,
        stale: true,
        offline: net.offline ?? true,
    };
}

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
                return { widgets, rows, error: msg, stale: true, offline };
            }
        }

        // No cache or userId: return an empty + error envelope
        return { widgets: [], error: msg, stale: false, offline };
    }
}
