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
const RECENT_WINDOW_SIZE = 500;

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

    // Two parallel queries:
    //   1. All legendaries for this case (rare event — cheap even without tight cap).
    //   2. A broad window of recent openings to compute each user's best-ever.
    const [legendaryRes, recentRes] = await Promise.all([
        supabase
            .from("monster_opening")
            .select(OPENING_WITH_PROFILE_SELECT)
            .eq("case_type", caseType)
            .eq("rarity", "yellow")
            .order("opened_at", { ascending: false })
            .limit(LEGENDARY_FEED_LIMIT),
        supabase
            .from("monster_opening")
            .select(OPENING_WITH_PROFILE_SELECT)
            .eq("case_type", caseType)
            .order("opened_at", { ascending: false })
            .limit(RECENT_WINDOW_SIZE),
    ]);

    if (legendaryRes.error) {
        console.error("monster/highlights legendary query failed:", legendaryRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (recentRes.error) {
        console.error("monster/highlights recent query failed:", recentRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const legendaryRows = (legendaryRes.data ?? []) as unknown as OpeningWithProfileRow[];
    const recentRows = (recentRes.data ?? []) as unknown as OpeningWithProfileRow[];

    const legendaries = legendaryRows.map(toFeedItem);
    const bestPerUser = pickBestPerUser(recentRows).slice(0, BEST_PER_USER_LIMIT).map(toFeedItem);

    return NextResponse.json({ legendaries, bestPerUser });
}

/**
 * For each distinct user in `rows`, keep their highest-ranked drop.
 * Tiebreak on equal rarity: prefer the earlier opening (their original
 * highlight moment). Returns users sorted by rank desc, then opened_at desc.
 */
function pickBestPerUser(rows: OpeningWithProfileRow[]): OpeningWithProfileRow[] {
    const bestByUser = new Map<string, OpeningWithProfileRow>();
    for (const row of rows) {
        const prev = bestByUser.get(row.user_id);
        if (!prev) {
            bestByUser.set(row.user_id, row);
            continue;
        }
        const prevRank = RARITY_RANK[prev.rarity];
        const nextRank = RARITY_RANK[row.rarity];
        if (nextRank > prevRank) {
            bestByUser.set(row.user_id, row);
        } else if (nextRank === prevRank && row.opened_at < prev.opened_at) {
            bestByUser.set(row.user_id, row);
        }
    }
    return Array.from(bestByUser.values()).sort((a, b) => {
        const rankDiff = RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        if (rankDiff !== 0) return rankDiff;
        return b.opened_at.localeCompare(a.opened_at);
    });
}
