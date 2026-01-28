"use client";

import type { ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import WidgetContainer from "../WidgetContainer";
import { useTranslations } from "next-intl";

export default function StaleState({
    widgets,
    userId,
}: {
    widgets: AnyWidget[];
    userId: string | null;
}): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <div className="space-y-4 text-white">
            <div className="border-status-error-muted bg-status-error/50 rounded-lg border p-4 text-center">
                {t("staleBanner")}
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
