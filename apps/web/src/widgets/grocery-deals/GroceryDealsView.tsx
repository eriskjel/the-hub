"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";
import { ReactElement, useState } from "react";
import Image from "next/image";

export default function GroceryDealsView({
    data,
    widget,
}: {
    data: Deal[];
    widget: GroceryDealsWidget;
}) {
    if (!data?.length) {
        return <div className="rounded-2xl bg-neutral-900 p-4 text-sm">No deals right now.</div>;
    }

    const max = widget.settings.maxResults ?? 12;
    const deals = data.slice(0, max);

    const [expanded, setExpanded] = useState(false);
    const collapsedCount = 1; // show just the cheapest; set to 2 if you want two

    const formatPrice = (n?: number) =>
        typeof n === "number"
            ? n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";

    const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("no-NO") : "");

    const rows = expanded ? deals : deals.slice(0, collapsedCount);
    const more = Math.max(0, deals.length - rows.length);

    return (
        <div className="rounded-2xl bg-neutral-900">
            {/* Compact header row (title is already above from WidgetContainer) */}

            {/* List */}
            <ul className={expanded ? "max-h-64 overflow-y-auto" : ""} aria-live="polite">
                {rows.map((d, i) => (
                    <li
                        key={i}
                        className="flex items-center gap-3 border-b border-neutral-800 px-3 py-2 last:border-0"
                    >
                        {/* tiny logo only; remove for super-minimal */}
                        {d.storeLogo ? (
                            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-neutral-800">
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
                            <div className="h-6 w-6 shrink-0 rounded bg-neutral-800" />
                        )}

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{d.name}</div>
                            <div className="truncate text-xs text-neutral-400">{d.store}</div>
                            <div className="mt-0.5 text-[11px] text-neutral-500">
                                {d.validUntil ? <>til {formatDate(d.validUntil)}</> : null}
                            </div>
                        </div>

                        <div className="shrink-0 text-right">
                            <div className="text-sm font-semibold">{formatPrice(d.price)} kr</div>
                            {typeof d.unitPrice === "number" ? (
                                <div className="text-[11px] text-neutral-400">
                                    {formatPrice(d.unitPrice)}/l
                                </div>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ul>

            {/* Footer / expand toggle */}
            {more > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full px-3 py-2 text-xs text-neutral-300 transition hover:text-white/90"
                    aria-expanded={expanded}
                >
                    {expanded ? "Vis færre" : `Vis ${more} flere`}
                </button>
            )}
        </div>
    );
}
