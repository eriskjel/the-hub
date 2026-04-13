import { type NextRequest, NextResponse } from "next/server";
import { isCaseKey, type DrinkRarity } from "@/lib/monster/catalog";
import {
    OPENING_WITH_PROFILE_SELECT,
    toFeedItem,
    type OpeningWithProfileRow,
} from "@/lib/monster/feedRow";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/** Ranking for "best-ever drop" dedupe. Higher = rarer. */
const RARITY_RANK: Record<DrinkRarity, number> = {
    blue: 1,
    purple: 2,
    pink: 3,
    red: 4,
    yellow: 5,
};

const LEGENDARY_FEED_LIMIT = 50;
const BEST_PER_USER_LIMIT = 15;

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const caseTypeParam = req.nextUrl.searchParams.get("type") ?? "monster";
    if (!isCaseKey(caseTypeParam)) {
        return NextResponse.json({ error: "invalid_case_type" }, { status: 400 });
    }
    const caseType = caseTypeParam;

    // Parallel:
    //   1. Every legendary for this case (rare event — cheap).
    //   2. Pre-aggregated per-(user,rarity) counts to derive each user's
    //      all-time top rarity. Aggregated DB-side, so this is tiny no matter
    //      how many openings exist.
    const [legendaryRes, statsRes] = await Promise.all([
        supabase
            .from("monster_opening")
            .select(OPENING_WITH_PROFILE_SELECT)
            .eq("case_type", caseType)
            .eq("rarity", "yellow")
            .order("opened_at", { ascending: false })
            .limit(LEGENDARY_FEED_LIMIT),
        supabase
            .from("monster_opening_stats")
            .select("user_id, rarity, count")
            .eq("case_type", caseType),
    ]);

    if (legendaryRes.error) {
        console.error("monster/highlights legendary query failed:", legendaryRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (statsRes.error) {
        console.error("monster/highlights stats query failed:", statsRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const legendaryRows = (legendaryRes.data ?? []) as unknown as OpeningWithProfileRow[];
    const legendaries = legendaryRows.map(toFeedItem);

    const topRarityByUser = computeTopRarityByUser(
        (statsRes.data ?? []) as Array<{ user_id: string; rarity: DrinkRarity; count: number }>
    );
    const bestPerUser = await fetchBestPerUser(supabase, caseType, topRarityByUser);

    return NextResponse.json({ legendaries, bestPerUser });
}

/** For each user, find the rarest tier they've ever pulled at least once. */
function computeTopRarityByUser(
    rows: Array<{ user_id: string; rarity: DrinkRarity; count: number }>
): Map<string, DrinkRarity> {
    const top = new Map<string, DrinkRarity>();
    for (const row of rows) {
        if (row.count <= 0) continue;
        const prev = top.get(row.user_id);
        if (!prev || RARITY_RANK[row.rarity] > RARITY_RANK[prev]) {
            top.set(row.user_id, row.rarity);
        }
    }
    return top;
}

/**
 * Given each user's all-time top rarity, fetch the earliest opening of that
 * rarity (their original "I pulled this!" moment). Bounded by number of
 * active users × their top rarities — not by total openings.
 */
async function fetchBestPerUser(
    supabase: Awaited<ReturnType<typeof createClient>>,
    caseType: string,
    topRarityByUser: Map<string, DrinkRarity>
) {
    if (topRarityByUser.size === 0) return [];

    const userIds = Array.from(topRarityByUser.keys());
    const topRarities = Array.from(new Set(topRarityByUser.values()));

    const { data, error } = await supabase
        .from("monster_opening")
        .select(OPENING_WITH_PROFILE_SELECT)
        .eq("case_type", caseType)
        .in("user_id", userIds)
        .in("rarity", topRarities)
        .order("opened_at", { ascending: true });

    if (error) {
        console.error("monster/highlights best-per-user query failed:", error.message);
        return [];
    }

    // Keep the earliest opening that matches each user's top rarity.
    // Rows may include openings at rarities below the user's top (because
    // we filtered by `rarity IN topRarities`, not per-user) — discard those.
    const rows = (data ?? []) as unknown as OpeningWithProfileRow[];
    const bestByUser = new Map<string, OpeningWithProfileRow>();
    for (const row of rows) {
        if (topRarityByUser.get(row.user_id) !== row.rarity) continue;
        if (!bestByUser.has(row.user_id)) bestByUser.set(row.user_id, row);
    }

    return Array.from(bestByUser.values())
        .sort((a, b) => {
            const rankDiff = RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
            if (rankDiff !== 0) return rankDiff;
            return a.opened_at.localeCompare(b.opened_at); // earliest first within tier
        })
        .slice(0, BEST_PER_USER_LIMIT)
        .map(toFeedItem);
}
