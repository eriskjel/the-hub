"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal, GroceryDealsResponse } from "@/widgets/grocery-deals/types";
import React, { ReactElement, useEffect, useId, useRef, useState } from "react";

/** Refetch when backend returned raw list (Gemini still running). Delay 20s so first refetch runs after typical Gemini (e.g. 6–17s); then repeat to catch very slow runs (20–45s). */
const REFETCH_DELAY_MS = 20_000;
const MAX_REFETCH_ATTEMPTS = 4;
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

const formatPrice = (n?: number) =>
    typeof n === "number"
        ? n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

const formatPerKg = (n?: number) => (typeof n === "number" ? `${formatPrice(n)} kr/kg` : "");
const formatPerUnit = (n?: number, unit?: string) =>
    typeof n === "number" && unit ? `${formatPrice(n)} ${unit}` : "";

/** Pack/size only for left subtitle (e.g. "6×1.5l"); per-unit is shown on the right. */
function subtitle(d: Deal): string {
    const pcsFrom = d.pieceCountFrom ?? 0;
    const pcsTo = d.pieceCountTo ?? 0;
    const sizeFrom = d.unitSizeFrom ?? 0;
    const sizeTo = d.unitSizeTo ?? 0;
    const sym = d.unitSymbol ?? "";

    const hasPack = pcsFrom > 1 || pcsTo > 1;
    const hasSize = sizeFrom > 0 || sizeTo > 0;

    if (hasPack && hasSize) {
        const pcsStr = pcsTo && pcsTo !== pcsFrom ? `${pcsFrom}–${pcsTo}` : `${pcsFrom || pcsTo}`;
        const sizeStr =
            sizeTo && sizeTo !== sizeFrom
                ? `${sizeFrom}–${sizeTo}${sym}`
                : `${sizeFrom || sizeTo}${sym}`;
        return `${pcsStr}×${sizeStr}`;
    }
    if (hasPack) {
        const pcsStr = pcsTo && pcsTo !== pcsFrom ? `${pcsFrom}–${pcsTo}` : `${pcsFrom || pcsTo}`;
        return `${pcsStr}×`;
    }
    if (hasSize) {
        const sizeStr =
            sizeTo && sizeTo !== sizeFrom
                ? `${sizeFrom}–${sizeTo}${sym}`
                : `${sizeFrom || sizeTo}${sym}`;
        return sizeStr;
    }
    return "";
}

/** Per-unit line for right column: Gemini display unit or static kr/kg (same logic as backend). */
function perUnitLine(d: Deal): string {
    if (typeof d.displayPricePerUnit === "number" && d.displayUnit)
        return formatPerUnit(d.displayPricePerUnit, d.displayUnit);
    if (
        typeof d.unitPriceMin === "number" &&
        typeof d.unitPriceMax === "number" &&
        d.unitPriceMin !== d.unitPriceMax
    )
        return perKgRange(d.unitPriceMin, d.unitPriceMax) || safePerKg(d.unitPrice) || "";
    const up = d.unitPrice ?? d.unitPriceMax ?? d.unitPriceMin;
    return safePerKg(up);
}

function normalizeData(data: Deal[] | GroceryDealsResponse | null | undefined): {
    deals: Deal[];
    isEnriched: boolean;
} {
    if (!data) return { deals: [], isEnriched: true };
    if (Array.isArray(data)) return { deals: data, isEnriched: true };
    return { deals: data.deals ?? [], isEnriched: data.isEnriched ?? true };
}

export default function GroceryDealsView({
    data,
    widget,
    refetch,
}: {
    data: Deal[] | GroceryDealsResponse | null | undefined;
    widget: GroceryDealsWidget;
    refetch?: () => void;
}): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals.view");
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const listRef = React.useRef<HTMLUListElement>(null);
    const { deals: rawDeals, isEnriched } = normalizeData(data);
    const refetchScheduledRef = useRef(false);
    const refetchCountRef = useRef(0);

    // Fast-first, refetch-later: when data is not enriched, schedule refetches every REFETCH_DELAY_MS (up to MAX_REFETCH_ATTEMPTS)
    useEffect(() => {
        if (isEnriched || !refetch || refetchCountRef.current >= MAX_REFETCH_ATTEMPTS) return;
        if (refetchScheduledRef.current) return;
        refetchScheduledRef.current = true;
        const tId = setTimeout(() => {
            refetchCountRef.current += 1;
            refetchScheduledRef.current = false;
            refetch();
        }, REFETCH_DELAY_MS);
        return () => {
            clearTimeout(tId);
            refetchScheduledRef.current = false;
        };
    }, [isEnriched, refetch]);

    if (!rawDeals.length) {
        return <div className="text-muted-light text-sm">{t("noDeals")}</div>;
    }

    const max = widget.settings.maxResults;
    const deals: Deal[] = rawDeals.slice(0, max);

    const collapsedCount = 1;
    const totalMore = Math.max(0, deals.length - collapsedCount);
    const hasMore = deals.length > collapsedCount;

    return (
        <>
            <ul
                ref={listRef}
                id={listId}
                className={`widget-scrollbar space-y-1 transition-all duration-300 ease-in-out ${
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

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("no-NO") : "");

function renderRows(
    rows: Deal[],
    t: ReturnType<typeof useTranslations>,
    expanded: boolean,
    collapsedCount: number
): ReactElement[] {
    return rows.map((deal: Deal, i) => {
        const isHidden = !expanded && i >= collapsedCount;
        const unitLine = perUnitLine(deal);
        return (
            <li
                key={i}
                inert={isHidden}
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
                    <div className="text-foreground truncate text-sm font-semibold">
                        {deal.displayName ?? deal.name}
                    </div>
                    <div className="text-muted truncate text-xs font-medium">{deal.store}</div>
                    {(() => {
                        const sub = subtitle(deal);
                        return sub ? (
                            <div className="text-muted truncate text-xs">{sub}</div>
                        ) : null;
                    })()}
                    {deal.validUntil ? (
                        <div className="text-muted mt-0.5 text-[11px]">
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
                    {unitLine ? <div className="text-muted text-[11px]">{unitLine}</div> : null}
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
