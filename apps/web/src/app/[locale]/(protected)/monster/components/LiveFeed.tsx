"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { MonsterFeedItem } from "../types";
import { FeedPanel } from "./FeedPanel";

export function LiveFeed({ paused = false }: { paused?: boolean }) {
    const t = useTranslations("monster");

    const { data, isError } = useQuery<{ items: MonsterFeedItem[] }>({
        queryKey: ["monster-feed"],
        queryFn: async () => {
            const res = await fetch("/api/monster/feed?limit=15");
            if (!res.ok) throw new Error("feed unavailable");
            return res.json();
        },
        // Pause polling during a spin so the user's own drop (and other players')
        // can't appear in the feed before the spinner reveals it.
        refetchInterval: paused ? false : 8000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: !paused,
        retry: false,
    });

    if (isError || !data?.items?.length) return null;

    return <FeedPanel title={t("feed.title")} items={data.items} labelOpened={t("feed.opened")} />;
}
