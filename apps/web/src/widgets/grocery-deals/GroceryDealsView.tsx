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
        right = perKgRange(d.unitPriceMin, d.unitPriceMax) || safePerKg(d.unitPrice);
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
    const listRef = React.useRef<HTMLUListElement>(null);

    if (!data?.length) {
        return <div className="text-sm text-neutral-700">{t("noDeals")}</div>;
    }

    const max = widget.settings.maxResults;
    const deals: Deal[] = data.slice(0, max);

    const collapsedCount = 1;
    const totalMore = Math.max(0, deals.length - collapsedCount);
    const hasMore = deals.length > collapsedCount;
    const isSingleItem = deals.length === 1 && !hasMore;

    return (
        <div className={isSingleItem ? "flex h-full min-h-0 flex-1 flex-col justify-center" : ""}>
            <ul
                ref={listRef}
                id={listId}
                className={`space-y-1 transition-all duration-300 ease-in-out [scrollbar-gutter:stable] [scrollbar-width:thin] ${
                    expanded ? "max-h-64 overflow-y-auto pr-2 md:pr-3" : "max-h-24 overflow-hidden"
                }`}
                aria-live="polite"
            >
                {renderRows(deals, t, expanded, collapsedCount)}
            </ul>

            {hasMore && (
                <button
                    type="button"
                    aria-controls={listId}
                    aria-expanded={expanded}
                    onClick={() => {
                        if (expanded && listRef.current) {
                            // Scroll to top when collapsing
                            listRef.current.scrollTop = 0;
                        }
                        setExpanded((v) => !v);
                    }}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-800 transition-colors duration-200 hover:bg-neutral-100"
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

function renderRows(
    rows: Deal[],
    t: ReturnType<typeof useTranslations>,
    expanded: boolean,
    collapsedCount: number
): ReactElement[] {
    return rows.map((deal: Deal, i) => {
        const isHidden = !expanded && i >= collapsedCount;
        return (
            <li
                key={i}
                className={`flex items-start gap-3 rounded-lg px-2 py-2.5 transition-all duration-300 ease-in-out hover:bg-neutral-50 ${
                    isHidden
                        ? "pointer-events-none -mt-1 max-h-0 overflow-hidden opacity-0"
                        : "max-h-none opacity-100"
                }`}
            >
                {deal.storeLogo ? (
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                        <Image
                            src={deal.storeLogo}
                            alt={deal.store || "store"}
                            fill
                            sizes="32px"
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                ) : (
                    <div className="h-8 w-8 shrink-0 rounded-md bg-neutral-100" />
                )}

                {/* LEFT: flexible, can truncate */}
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm font-semibold text-neutral-900">
                        {deal.name}
                    </div>
                    <div className="truncate text-xs font-medium text-neutral-600">
                        {deal.store}
                    </div>
                    {(() => {
                        const sub = subtitle(deal);
                        return sub ? (
                            <div className="truncate text-xs text-neutral-600">{sub}</div>
                        ) : null;
                    })()}
                    {deal.validUntil ? (
                        <div className="mt-0.5 text-[11px] text-neutral-600">
                            {t("until")} {formatDate(deal.validUntil)}
                        </div>
                    ) : null}
                </div>

                {/* RIGHT: fixed width so left side doesn't “move in” */}
                <div className="shrink-0 grow-0 basis-28 text-right sm:basis-32">
                    <div className="text-base font-bold text-neutral-900">
                        {formatPrice(deal.price)} {t("currency")}
                    </div>
                    {deal.multipack && typeof deal.perPiecePrice === "number" ? (
                        <div className="text-[11px] text-neutral-600">
                            {formatPrice(deal.perPiecePrice)} {t("currency")}/stk
                        </div>
                    ) : null}
                    {typeof deal.unitPrice === "number" && !deal.multipack ? (
                        <div className="text-[11px] text-neutral-600">
                            {formatPerKg(deal.unitPrice)}
                        </div>
                    ) : null}
                </div>
            </li>
        );
    });
}

const safePerKg = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? `${formatPrice(n)} kr/kg` : "";

const perKgRange = (min?: number, max?: number) => {
    const a = safePerKg(min);
    const b = safePerKg(max);
    if (a && b && a !== b) return `${a}–${b}`;
    return a || b || "";
};
