"use client";

import type { GroceryDealsWidget } from "@/widgets/schema";
import { Deal } from "@/widgets/grocery-deals/types";

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

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {data.slice(0, widget.settings.maxResults ?? 12).map((d, i) => (
                <div key={i} className="flex gap-3 rounded-2xl bg-neutral-900 p-3">
                    {d.image ? (
                        <img
                            src={d.image}
                            alt={d.name}
                            className="h-16 w-16 rounded-lg object-cover"
                        />
                    ) : (
                        <div className="h-16 w-16 rounded-lg bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{d.name}</div>
                        <div className="truncate text-xs text-neutral-400">{d.store}</div>
                        <div className="mt-0.5 text-sm">
                            {d.price.toFixed(2)} kr
                            {d.unitPrice ? ` · ${d.unitPrice.toFixed(2)}/l` : ""}
                        </div>
                        {d.validUntil ? (
                            <div className="mt-0.5 text-[11px] text-neutral-500">
                                til {new Date(d.validUntil).toLocaleDateString()}
                            </div>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
