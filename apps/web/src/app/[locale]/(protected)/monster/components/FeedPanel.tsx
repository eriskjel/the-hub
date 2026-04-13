"use client";

import clsx from "clsx";
import { RARITY_POP_COLORS } from "../rarityStyles";
import type { MonsterFeedItem } from "../types";
import { formatTimeAgo } from "../utils/formatTimeAgo";

/**
 * Shared look for feed-style panels in the monster page (live drops,
 * legendaries, best-per-user). Kept visually identical so the three feeds
 * share one language.
 */
export function FeedPanel({
    title,
    items,
    labelOpened,
}: {
    title: string;
    items: MonsterFeedItem[];
    labelOpened: string;
}) {
    return (
        <div className="border-border bg-surface w-full rounded-xl border p-4">
            <h3 className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
                {title}
            </h3>
            <div className="max-h-[280px] space-y-1 overflow-y-auto">
                {items.map((item) => (
                    <FeedRow key={item.id} item={item} labelOpened={labelOpened} />
                ))}
            </div>
        </div>
    );
}

function FeedRow({ item, labelOpened }: { item: MonsterFeedItem; labelOpened: string }) {
    return (
        <div
            className={clsx(
                "flex items-center justify-between rounded-lg border px-2.5 py-1 text-sm",
                RARITY_POP_COLORS[item.rarity]
            )}
        >
            <span>
                <span className="text-foreground font-medium">{item.username}</span>
                <span className="text-muted"> {labelOpened} </span>
                <span className="text-foreground font-medium">{item.item}</span>
            </span>
            <span className="text-muted text-xs">{formatTimeAgo(item.openedAt)}</span>
        </div>
    );
}
