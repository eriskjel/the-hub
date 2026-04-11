"use client";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { RARITY_COLORS } from "../rarityStyles";
import type { DrinkRarity } from "../types";

type FeedItem = {
    id: string;
    caseType: string;
    item: string;
    rarity: DrinkRarity;
    openedAt: string;
    username: string;
    avatarUrl: string | null;
};

export function LiveFeed() {
    const t = useTranslations("monster");

    const { data, isError } = useQuery<{ items: FeedItem[] }>({
        queryKey: ["monster-feed"],
        queryFn: async () => {
            const res = await fetch("/api/monster/feed?limit=15");
            if (!res.ok) throw new Error("feed unavailable");
            return res.json();
        },
        refetchInterval: 8000,
        refetchIntervalInBackground: false,
        retry: false,
    });

    if (isError || !data?.items?.length) return null;

    return (
        <div className="border-border bg-surface w-full rounded-xl border p-4">
            <h3 className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
                {t("feed.title")}
            </h3>
            <div className="max-h-[280px] space-y-1 overflow-y-auto">
                {data.items.map((item) => (
                    <div
                        key={item.id}
                        className={clsx(
                            "flex items-center justify-between rounded-lg px-2.5 py-1 text-sm",
                            RARITY_COLORS[item.rarity]
                        )}
                    >
                        <span>
                            <span className="text-foreground font-medium">{item.username}</span>
                            <span className="text-muted"> {t("feed.opened")} </span>
                            <span className="text-foreground font-medium">{item.item}</span>
                        </span>
                        <span className="text-muted text-xs">{formatTimeAgo(item.openedAt)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatTimeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}
