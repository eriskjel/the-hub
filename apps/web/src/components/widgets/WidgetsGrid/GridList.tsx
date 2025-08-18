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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map(
                (widget: AnyWidget): ReactElement => (
                    <WidgetContainer key={widget.instanceId} widget={widget} userId={userId} />
                )
            )}
        </div>
    );
}
