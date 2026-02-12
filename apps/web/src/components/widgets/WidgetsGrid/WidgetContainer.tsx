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

/** "pepsi max" → "Pepsi Max", "monster" → "Monster" */
function toTitleCase(s: string): string {
    return s
        .split(/\s+/)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ");
}

/** "Trondheim, Trøndelag, Norge" → "Trondheim" */
function cityOnly(raw: string): string {
    return raw.split(",")[0].trim();
}

/** Build a descriptive title; falls back to the translated kind label. */
function resolveTitle(widget: AnyWidget, kindLabel: string): string {
    switch (widget.kind) {
        case "grocery-deals": {
            const s = (widget as GroceryDealsWidget).settings;
            const query = s?.query ? toTitleCase(s.query.trim()) : "";
            const city = s?.city ? cityOnly(s.city) : "";
            if (query && city) return `${query} · ${city}`;
            return query || kindLabel;
        }
        case "countdown": {
            const s = widget.settings;
            if (s?.source === "provider") {
                if (s.provider === "trippel-trumf") return "Trippel-Trumf";
                if (s.provider === "dnb-supertilbud") return "DNB Supertilbud";
            }
            return kindLabel;
        }
        case "server-pings": {
            const target = widget.settings?.target;
            return typeof target === "string" ? target : kindLabel;
        }
        default:
            return kindLabel;
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

    const title = resolveTitle(widget, kindLabel);

    const header: ReactElement = <Header title={title} />;
    const actions = (
        <div className="flex items-center gap-2">
            {isEditableKind(widget.kind) && (
                <EditWidgetButton
                    widget={widget}
                    userId={userId ?? undefined}
                    backendUnreachable={stale}
                />
            )}
            <DeleteWidgetButton
                widgetId={widget.instanceId}
                widgetTitle={title}
                userId={userId}
                kind={widget.kind}
                backendUnreachable={stale}
            />
        </div>
    );

    // Minimum height for all widgets - can expand beyond this (e.g., grocery expanded)
    // Header ~48px + content ~148px = 196px base
    return (
        <GlassCard
            header={header}
            actions={actions}
            stale={stale}
            variant="solid"
            tone="light"
            className="min-h-[196px] self-start"
        >
            <WidgetCard widget={widget} userId={userId} staleLayout={stale} />
        </GlassCard>
    );
}

function Header({ title }: { title: string }): ReactElement {
    return <div className="text-foreground truncate text-sm font-semibold">{title}</div>;
}
