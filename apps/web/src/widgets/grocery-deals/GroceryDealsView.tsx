"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";
import React, { ReactElement, useId, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

const formatPerKg = (n?: number) => (typeof n === "number" ? `${formatPrice(n)} kr/kg` : "");

function subtitle(d: Deal): string {
    const pcsFrom = d.pieceCountFrom ?? 0;
    const pcsTo = d.pieceCountTo ?? 0;
    const sizeFrom = d.unitSizeFrom ?? 0;
    const sizeTo = d.unitSizeTo ?? 0;
    const sym = d.unitSymbol ?? "";

    // 1) Multipack with size known: "4×100g • 250 kr/kg" or "2–4×141–200g • 225–319 kr/kg"
    const hasPack = pcsFrom > 1 || pcsTo > 1;
    const hasSize = sizeFrom > 0 || sizeTo > 0;

    let left = "";
    if (hasPack && hasSize) {
        const pcsStr = pcsTo && pcsTo !== pcsFrom ? `${pcsFrom}–${pcsTo}` : `${pcsFrom || pcsTo}`;
        const sizeStr =
            sizeTo && sizeTo !== sizeFrom
                ? `${sizeFrom}–${sizeTo}${sym}`
                : `${sizeFrom || sizeTo}${sym}`;
        left = `${pcsStr}×${sizeStr}`;
    } else if (hasPack) {
        const pcsStr = pcsTo && pcsTo !== pcsFrom ? `${pcsFrom}–${pcsTo}` : `${pcsFrom || pcsTo}`;
        left = `${pcsStr}×`;
    } else if (hasSize) {
        const sizeStr =
            sizeTo && sizeTo !== sizeFrom
                ? `${sizeFrom}–${sizeTo}${sym}`
                : `${sizeFrom || sizeTo}${sym}`;
        left = sizeStr;
    }

    // per-kg: show min–max if range; else single
    let right = "";
    if (
        typeof d.unitPriceMin === "number" &&
        typeof d.unitPriceMax === "number" &&
        d.unitPriceMin !== d.unitPriceMax
    ) {
        right = `${formatPerKg(d.unitPriceMin)}–${formatPerKg(d.unitPriceMax)}`;
    } else {
        const up = d.unitPrice ?? d.unitPriceMax ?? d.unitPriceMin;
        right = formatPerKg(up);
    }

    if (left && right) return `${left} • ${right}`;
    return left || right || "";
}

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
        return <div className="text-sm text-neutral-700">{t("noDeals")}</div>;
    }

    const max = widget.settings.maxResults;
    const deals: Deal[] = data.slice(0, max);

    const collapsedCount = 1;
    const rows: Deal[] = expanded ? deals : deals.slice(0, collapsedCount);
    const totalMore = Math.max(0, deals.length - collapsedCount);
    const hasMore = deals.length > collapsedCount;

    return (
        <div>
            <ul
                id={listId}
                className={`divide-y divide-neutral-200 ${expanded ? "scroll-gutter-stable max-h-64 overflow-y-auto pr-1 md:pr-2" : ""}`}
                aria-live="polite"
            >
                {renderRows(rows, t)}
            </ul>

            {hasMore && (
                <button
                    type="button"
                    aria-controls={listId}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-800 transition hover:bg-neutral-100"
                >
                    {expanded ? t("showLess") : t("showMore", { count: totalMore })}
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
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-neutral-100">
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
                <div className="h-6 w-6 shrink-0 rounded bg-neutral-100" />
            )}

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{d.name}</div>
                <div className="truncate text-xs text-neutral-700">{d.store}</div>
                {(() => {
                    const sub = subtitle(d);
                    return sub ? (
                        <div className="truncate text-xs text-neutral-600">{sub}</div>
                    ) : null;
                })()}
                {d.validUntil ? (
                    <div className="mt-0.5 text-[11px] text-neutral-600">
                        {t("until")} {formatDate(d.validUntil)}
                    </div>
                ) : null}
            </div>

            <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-neutral-900">
                    {formatPrice(d.price)} {t("currency")}
                </div>

                {/* show per-piece for multipacks */}
                {d.multipack && typeof d.perPiecePrice === "number" ? (
                    <div className="text-[11px] text-neutral-600">
                        {formatPrice(d.perPiecePrice)} {t("currency")}/stk
                    </div>
                ) : null}

                {/* keep legacy unit price line if you want */}
                {typeof d.unitPrice === "number" && !d.multipack ? (
                    <div className="text-[11px] text-neutral-600">{formatPerKg(d.unitPrice)}</div>
                ) : null}
            </div>
        </li>
    ));
}
