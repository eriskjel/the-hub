"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";
import React, { ReactElement, useId, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

export default function GroceryDealsView({
    data,
    widget,
}: {
    data: Deal[];
    widget: GroceryDealsWidget;
}): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals.view");
    const [expanded, setExpanded] = useState(false);
    const listId = useId();

    if (!data?.length) {
        return <div className="text-sm text-white/80">{t("noDeals")}</div>;
    }

    const max = widget.settings.maxResults;
    const deals: Deal[] = data.slice(0, max);

    const collapsedCount = 1; // show only the cheapest when collapsed
    const rows: Deal[] = expanded ? deals : deals.slice(0, collapsedCount);
    const more = Math.max(0, deals.length - rows.length);

    return (
        <div>
            <ul
                id={listId}
                className={`divide-y divide-white/20 ${expanded ? "max-h-64 overflow-y-auto" : ""}`}
                aria-live="polite"
            >
                {renderRows(rows, t)}
            </ul>

            {more > 0 && (
                <button
                    type="button"
                    aria-controls={listId}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                    {expanded ? t("showLess") : t("showMore", { count: more })}
                </button>
            )}
        </div>
    );
}

const formatPrice = (n?: number) =>
    typeof n === "number"
        ? n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("no-NO") : "");

function renderRows(rows: Deal[], t: ReturnType<typeof useTranslations>): ReactElement[] {
    return rows.map((d, i) => (
        <li key={i} className="flex items-center gap-3 py-2">
            {d.storeLogo ? (
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-white/10">
                    <Image
                        src={d.storeLogo}
                        alt={d.store || "store"}
                        fill
                        sizes="24px"
                        className="object-contain"
                        unoptimized
                    />
                </div>
            ) : (
                <div className="h-6 w-6 shrink-0 rounded bg-white/10" />
            )}

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{d.name}</div>
                <div className="truncate text-xs text-white/80">{d.store}</div>
                {d.validUntil ? (
                    <div className="mt-0.5 text-[11px] text-white/60">
                        {t("until")} {formatDate(d.validUntil)}
                    </div>
                ) : null}
            </div>

            <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-white">
                    {formatPrice(d.price)} {t("currency")}
                </div>{" "}
                {typeof d.unitPrice === "number" ? (
                    <div className="text-[11px] text-white/70">
                        {formatPrice(d.unitPrice)}
                        {d.unit ? `/${d.unit}` : ""}
                    </div>
                ) : null}
            </div>
        </li>
    ));
}
