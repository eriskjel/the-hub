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
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget: AnyWidget): ReactElement => {
                const x: number = (widget.grid?.x ?? 0) + 1;
                const y: number = (widget.grid?.y ?? 0) + 1;
                const w: number = widget.grid?.w ?? 1;
                const h: number = widget.grid?.h ?? 1;

                return (
                    <div
                        key={widget.instanceId}
                        className="contents lg:block lg:h-fit lg:self-start"
                        style={{
                            gridColumn: `${x} / span ${w}`,
                            gridRow: `${y} / span ${h}`,
                        }}
                    >
                        <WidgetContainer widget={widget} userId={userId} />
                    </div>
                );
            })}
        </div>
    );
}
