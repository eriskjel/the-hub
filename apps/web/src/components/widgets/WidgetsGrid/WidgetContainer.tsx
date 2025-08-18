"use client";

import type { ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";

export default function WidgetContainer({
    widget,
    userId,
    stale = false,
}: {
    widget: AnyWidget;
    userId: string | null;
    stale?: boolean;
}): ReactElement {
    return (
        <div className="rounded-2xl bg-neutral-900 p-2">
            <div className="px-2 py-1 text-sm text-neutral-400">{widget.title}</div>
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </div>
    );
}
