"use client";

import type { ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetContainer from "./WidgetContainer";

export default function GridList({
    widgets,
    userId,
}: {
    widgets: AnyWidget[];
    userId: string | null;
}): ReactElement {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget) => (
                <div
                    key={widget.instanceId}
                    // On mobile: don't care about DB coords
                    className="contents lg:block"
                    style={{
                        gridColumn: `${widget.grid.x + 1} / span ${widget.grid.w ?? 1}`,
                        gridRow: `${widget.grid.y + 1} / span ${widget.grid.h ?? 1}`,
                    }}
                >
                    <WidgetContainer widget={widget} userId={userId} />
                </div>
            ))}
        </div>
    );
}
