"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";
import { ReactElement } from "react";
import Image from "next/image";

export default function GroceryDealsView({
    data,
    widget,
}: {
    data: Deal[];
    widget: GroceryDealsWidget;
}): ReactElement {
    if (!data?.length) {
        return <div className="rounded-2xl bg-neutral-900 p-4 text-sm">No deals right now.</div>;
    }

    const formatPrice = (n: number | undefined) =>
        typeof n === "number" ? n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

    const formatDate = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString("no-NO") : "";

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {data.slice(0, widget.settings.maxResults ?? 12).map((d, i) => (
                <div key={i} className="flex gap-3 rounded-2xl bg-neutral-900 p-3">
                    {d.image ? (
                        <div className="relative h-16 w-16">
                            <Image
                                src={d.image}
                                alt={d.name}
                                fill
                                sizes="64px"
                                className="rounded-lg object-cover"
                            />
                        </div>
                    ) : (
                        <div className="h-16 w-16 rounded-lg bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{d.name}</div>
                        <div className="truncate text-xs text-neutral-400">{d.store}</div>
                        <div className="mt-0.5 text-sm">
                            {formatPrice(d.price)} kr{typeof d.unitPrice === "number" ? ` · ${formatPrice(d.unitPrice)}/l` : ""}
                        </div>
                        {d.validUntil ? (
                            <div className="mt-0.5 text-[11px] text-neutral-500">til {formatDate(d.validUntil)}</div>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
