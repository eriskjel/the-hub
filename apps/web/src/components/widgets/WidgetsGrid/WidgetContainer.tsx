"use client";

import type { ReactElement } from "react";
import type { AnyWidget, GroceryDealsWidget, WidgetKind } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";
import GlassCard from "@/components/ui/GlassCard";
import { useTranslations } from "next-intl";

const KIND_KEYS: Record<WidgetKind, string> = {
    "server-pings": "server-pings",
    "pi-health": "pi-health",
    "grocery-deals": "grocery-deals",
};

function isGrocery(w: AnyWidget): w is GroceryDealsWidget {
    return w.kind === "grocery-deals";
}

export default function WidgetContainer({
    widget,
    userId,
    stale = false,
}: {
    widget: AnyWidget;
    userId: string | null;
    stale?: boolean;
}): ReactElement {
    const tKinds = useTranslations("widgets.create.kinds");

    const kindLabel = tKinds(KIND_KEYS[widget.kind]);

    const pill =
        isGrocery(widget) && widget.settings.query ? (
            <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                {widget.settings.query}
            </span>
        ) : null;

    const header = <Header kindLabel={kindLabel} pill={pill} />;

    return (
        <GlassCard header={header} stale={stale}>
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </GlassCard>
    );
}

function Header({
    kindLabel,
    pill,
}: {
    kindLabel: string;
    pill: ReactElement | null;
}): ReactElement {
    return (
        <>
            <div className="truncate text-sm font-semibold text-white">{kindLabel}</div>
            {pill}
        </>
    );
}
