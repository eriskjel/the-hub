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
        <div
            className="grid gap-4"
            style={{
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))", // 3 columns
            }}
        >
            {widgets.map((widget) => (
                <div
                    key={widget.instanceId}
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
