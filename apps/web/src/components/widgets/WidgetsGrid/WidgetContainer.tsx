"use client";

import type { ReactElement } from "react";
import type { AnyWidget, GroceryDealsWidget, WidgetKind } from "@/widgets/schema";
import WidgetCard from "@/components/widgets/WidgetCard";
import GlassCard from "@/components/ui/GlassCard";
import { DeleteWidgetButton } from "@/components/widgets/delete/DeleteWidgetButton";
import { useTranslations } from "next-intl";
import { EditWidgetButton } from "@/components/widgets/edit/EditWidgetButton";
import { isEditableKind } from "@/widgets/create/registry";

const KIND_KEYS: Record<WidgetKind, string> = {
    "server-pings": "server-pings",
    "pi-health": "pi-health",
    "grocery-deals": "grocery-deals",
    countdown: "countdown",
    cinemateket: "cinemateket",
};

function toPascalCase(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";
}

function resolveRightTitle(widget: AnyWidget): string {
    switch (widget.kind) {
        case "grocery-deals": {
            const query = (widget as GroceryDealsWidget).settings?.query;
            return query ? toPascalCase(query.trim()) : "";
        }
        case "countdown": {
            const s = widget.settings;
            if (s?.source === "provider") {
                if (s.provider === "trippel-trumf") return "Trippel-Trumf";
                if (s.provider === "dnb-supertilbud") return "DNB Supertilbud";
            }
            return "";
        }
        case "server-pings": {
            const target = widget.settings?.target;
            return typeof target === "string" ? target : "";
        }
        default:
            return "";
    }
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

    const right = resolveRightTitle(widget);

    const title = right ? `${kindLabel} | ${right}` : kindLabel;

    const header: ReactElement = <Header title={title} />;
    const actions = (
        <div className="flex items-center gap-2">
            {isEditableKind(widget.kind) && (
                <EditWidgetButton widget={widget} userId={userId ?? undefined} />
            )}
            <DeleteWidgetButton
                widgetId={widget.instanceId}
                widgetTitle={title}
                userId={userId}
                kind={widget.kind}
            />
        </div>
    );

    return (
        <GlassCard
            header={header}
            actions={actions}
            stale={stale}
            variant="solid"
            tone="light"
            className="min-h-[180px]"
        >
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </GlassCard>
    );
}

function Header({ title }: { title: string }): ReactElement {
    return <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>;
}
