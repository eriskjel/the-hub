"use client";

import type { ReactElement } from "react";
import type { AnyWidget, GroceryDealsWidget, WidgetKind } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";
import GlassCard from "@/components/ui/GlassCard";
import { DeleteWidgetButton } from "@/components/widgets/delete/DeleteWidgetButton";
import { useTranslations } from "next-intl";
import { EditWidgetButton } from "@/components/widgets/edit/EditWidgetButton";
import { isEditableKind } from "@/widgets/create/registry";

type TitleMode = "title" | "query" | "auto";

/** CHANGE THIS to switch behavior globally:
 *  - "title":  Dagligvarekupp | <widget.title>  (fresh & cached)
 *  - "query":  Dagligvarekupp | <settings.query> (fresh & cached)
 *  - "auto":   fresh→query, cached→title
 */
const DEFAULT_TITLE_MODE: TitleMode = "title";

const KIND_KEYS: Record<WidgetKind, string> = {
    "server-pings": "server-pings",
    "pi-health": "pi-health",
    "grocery-deals": "grocery-deals",
};

function isGrocery(widget: AnyWidget): widget is GroceryDealsWidget {
    return widget.kind === "grocery-deals";
}

export default function WidgetContainer({
    widget,
    userId,
    stale = false,
    titleMode = DEFAULT_TITLE_MODE,
}: {
    widget: AnyWidget;
    userId: string | null;
    stale?: boolean;
    titleMode?: TitleMode;
}): ReactElement {
    const tKinds = useTranslations("widgets.create.kinds");
    const kindLabel = tKinds(KIND_KEYS[widget.kind]);

    const query =
        isGrocery(widget) && typeof widget.settings?.query === "string"
            ? widget.settings.query.trim()
            : "";

    const widgetTitle = widget.title.trim();

    const right =
        titleMode === "query"
            ? query
            : titleMode === "title"
              ? widgetTitle
              : /* auto */ stale
                ? widgetTitle
                : query;

    const title = right ? `${kindLabel} | ${right}` : kindLabel;

    const header: ReactElement = <Header title={title} />;
    const actions: ReactElement = (
        <>
            {isEditableKind(widget.kind) ? <EditWidgetButton widget={widget} userId={userId ?? undefined} /> : null}
            <DeleteWidgetButton
                widgetId={widget.instanceId}
                widgetTitle={widgetTitle || kindLabel}
                userId={userId}
                kind={widget.kind}
            />
        </>
    );

    return (
        <GlassCard header={header} actions={actions} stale={stale} variant="solid" tone="light">
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </GlassCard>
    );
}

function Header({ title }: { title: string }): ReactElement {
    return <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>;
}
