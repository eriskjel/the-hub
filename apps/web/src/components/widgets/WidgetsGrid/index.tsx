"use client";

import type { ReactElement } from "react";
import GridList from "./GridList";
import StaleState from "./states/StaleState";
import OfflineState from "./states/OfflineState";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import SeedWidgetsCacheWithRows from "@/components/widgets/_internal/SeedWidgetsCacheWithRows";
import { WidgetsResult } from "@/lib/widgets/getWidgets.server";

export default function WidgetsGrid({
    widgetsResult,
    userId,
}: {
    widgetsResult: WidgetsResult;
    userId: string | null;
}): ReactElement {
    const { widgets, rows, error, stale, offline } = widgetsResult;

    // 1) Stale: ONLY render the stale view
    if (stale) {
        return <StaleState widgets={widgets} userId={userId} />;
    }

    // 2) Offline empty
    if (widgets.length === 0 && offline) {
        return <OfflineState />;
    }

    // 3) True empty
    if (!error && widgets.length === 0) {
        return <EmptyState />;
    }

    // 4) Error empty
    if (error && widgets.length === 0) {
        return <ErrorState error={error} />;
    }

    // 5) Normal (fresh)
    return (
        <>
            {rows && rows.length > 0 && userId ? <SeedWidgetsCacheWithRows rows={rows} /> : null}
            <GridList widgets={widgets} userId={userId} />
        </>
    );
}
