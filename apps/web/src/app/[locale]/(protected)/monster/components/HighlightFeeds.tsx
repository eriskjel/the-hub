"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { CaseKey } from "../cases";
import type { MonsterFeedItem } from "../types";
import { FeedPanel } from "./FeedPanel";

type HighlightsResponse = {
    legendaries: MonsterFeedItem[];
    bestPerUser: MonsterFeedItem[];
};

export function HighlightFeeds({ caseKey, paused }: { caseKey: CaseKey; paused: boolean }) {
    const t = useTranslations("monster");

    const { data, isError } = useQuery<HighlightsResponse>({
        queryKey: ["monster-highlights", caseKey],
        queryFn: async () => {
            const res = await fetch(`/api/monster/highlights?type=${caseKey}`);
            if (!res.ok) throw new Error("highlights unavailable");
            return res.json();
        },
        // Same gating as LiveFeed — never refetch while a spin is mid-flight,
        // so the user's own legendary can't appear before the reveal.
        refetchInterval: paused ? false : 12000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: !paused,
        retry: false,
    });

    if (isError || !data) return null;

    const labelOpened = t("feed.opened");

    return (
        <>
            {data.legendaries.length > 0 && (
                <FeedPanel
                    title={t("highlights.legendary")}
                    items={data.legendaries}
                    labelOpened={labelOpened}
                />
            )}
            {data.bestPerUser.length > 0 && (
                <FeedPanel
                    title={t("highlights.bestPerUser")}
                    items={data.bestPerUser}
                    labelOpened={labelOpened}
                />
            )}
        </>
    );
}
