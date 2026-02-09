"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";
import React, { ReactElement, useId, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

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
        return <div className="text-muted-light text-sm">{t("noDeals")}</div>;
    }

    const max = widget.settings.maxResults;
    const deals: Deal[] = data.slice(0, max);

    const collapsedCount = 1;
    const totalMore = Math.max(0, deals.length - collapsedCount);
    const hasMore = deals.length > collapsedCount;

    return (
        <>
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
                    className="group bg-surface-subtle/50 text-muted hover:bg-surface-subtle hover:text-primary focus:ring-primary/20 mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 focus:ring-2 focus:outline-none"
                >
                    <span>{expanded ? t("showLess") : t("showMore", { count: totalMore })}</span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            expanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                    />
                </button>
            )}
        </>
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
                className={`hover:bg-surface-subtle flex items-start gap-3 rounded-lg px-2 py-2.5 transition-opacity duration-200 ease-in-out ${
                    isHidden ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
            >
                {deal.storeLogo ? (
                    <div className="relative h-8 w-8 shrink-0">
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
                    <div className="bg-surface-light h-8 w-8 shrink-0 rounded-md" />
                )}

                {/* LEFT: flexible, can truncate */}
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm font-semibold text-foreground">
                        {deal.name}
                    </div>
                    <div className="truncate text-xs font-medium text-muted">
                        {deal.store}
                    </div>
                    {(() => {
                        const sub = subtitle(deal);
                        return sub ? (
                            <div className="truncate text-xs text-muted">{sub}</div>
                        ) : null;
                    })()}
                    {deal.validUntil ? (
                        <div className="mt-0.5 text-[11px] text-muted">
                            {t("until")} {formatDate(deal.validUntil)}
                        </div>
                    ) : null}
                </div>

                {/* RIGHT: fixed width so left side doesn't “move in” */}
                <div className="shrink-0 grow-0 basis-28 text-right sm:basis-32">
                    <div className="text-foreground text-base font-bold">
                        {formatPrice(deal.price)} {t("currency")}
                    </div>
                    {deal.multipack && typeof deal.perPiecePrice === "number" ? (
                        <div className="text-muted text-[11px]">
                            {formatPrice(deal.perPiecePrice)} {t("currency")}/stk
                        </div>
                    ) : null}
                    {typeof deal.unitPrice === "number" && !deal.multipack ? (
                        <div className="text-muted text-[11px]">{formatPerKg(deal.unitPrice)}</div>
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
