"use client";

import type { ReactElement } from "react";
import GridList from "./GridList";
import StaleState from "./states/StaleState";
import OfflineState from "./states/OfflineState";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import SeedWidgetsCacheWithRows from "@/components/widgets/_internal/SeedWidgetsCacheWithRows";
import { WidgetsResult } from "@/lib/widgets/getWidgets.server";
import ActionBar from "./ActionBar";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";

/**
 * WidgetsGrid
 *
 * Orchestrates the dashboard grid:
 * - Decides which UI state to show (stale/offline/empty/error/normal)
 * - Seeds the widgets-list cookie when we have fresh data
 * - Renders the list of widget cards when things are normal
 *
 * Props:
 * - widgetsResult: result returned by `getWidgetsSafe()` (widgets, rows, status flags)
 * - userId: authenticated user's id (used by WidgetCard -> useWidgetData for per-user caching)
 */
export default function WidgetsGrid({
    widgetsResult,
    userId,
}: {
    widgetsResult: WidgetsResult;
    userId: string | null;
}): ReactElement {
    const { widgets, rows, error, stale, offline } = widgetsResult;

    // Only seed the cookie with the "slim" rows when the data is fresh (not stale).
    // This allows the dashboard to show cached widget *list* if the backend is temporarily unreachable.
    const maybeSeed: ReactElement | null =
        !stale && widgets.length > 0 && rows && rows.length > 0 && userId ? (
            <SeedWidgetsCacheWithRows rows={rows} userId={userId} />
        ) : null;

    // 1) Stale: we have cached values but the backend is degraded/offline right now
    if (stale) {
        return <StaleState widgets={widgets} userId={userId} />;
    }

    // 2) Offline empty: there are no widgets and the service is offline
    if (widgets.length === 0 && offline) {
        return <OfflineState />;
    }

    // 3) True empty: we’re online but the user simply has no widgets yet
    if (!error && widgets.length === 0) {
        return <EmptyState />;
    }

    // 4) Error empty: a hard error occurred and we have nothing to show
    if (error && widgets.length === 0) {
        return <ErrorState error={error} />;
    }

    // 5) Normal (fresh)
    return (
        <>
            {maybeSeed}
            <div className="mb-4 flex items-center justify-center">
                <CreateWidgetButton />
            </div>
            <GridList widgets={widgets} userId={userId} />
        </>
    );
}
