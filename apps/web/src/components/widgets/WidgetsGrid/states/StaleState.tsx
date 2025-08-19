"use client";

import type { ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetContainer from "../WidgetContainer";

export default function StaleState({
    widgets,
    userId,
}: {
    widgets: AnyWidget[];
    userId: string | null;
}): ReactElement {
    return (
        <div className="space-y-4 text-white">
            <div className=" rounded-lg border border-red-500/30 bg-red-500/50 p-4 text-center">
                Showing cached data — live updates unavailable
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {widgets.map(
                    (widget: AnyWidget): ReactElement => (
                        <WidgetContainer
                            key={widget.instanceId}
                            widget={widget}
                            userId={userId}
                            stale
                        />
                    )
                )}
            </div>
        </div>
    );
}
