import { type NextRequest, NextResponse } from "next/server";
import { isCaseKey, type DrinkRarity } from "@/lib/monster/catalog";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const EMPTY_COUNTS: Record<DrinkRarity, number> = {
    blue: 0,
    purple: 0,
    pink: 0,
    red: 0,
    yellow: 0,
};

type StatsRow = { user_id: string; case_type: string; rarity: string; count: number };

function accumulate(rows: StatsRow[]): { total: number; byRarity: Record<DrinkRarity, number> } {
    const byRarity = { ...EMPTY_COUNTS };
    let total = 0;
    for (const row of rows) {
        if (row.rarity in byRarity) {
            byRarity[row.rarity as DrinkRarity] += row.count;
            total += row.count;
        }
    }
    return { total, byRarity };
}

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

    // Fetch personal + global aggregate rows from the view in parallel.
    // Each row is one (user, case, rarity) tuple with a pre-computed count,
    // so at most ~5 rows per user per case. No full-table scans.
    const [personalRes, globalRes] = await Promise.all([
        supabase
            .from("monster_opening_stats")
            .select("user_id, case_type, rarity, count")
            .eq("user_id", user.id)
            .eq("case_type", caseType),
        supabase
            .from("monster_opening_stats")
            .select("user_id, case_type, rarity, count")
            .eq("case_type", caseType),
    ]);

    if (personalRes.error) {
        console.error("monster/stats personal query failed:", personalRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (globalRes.error) {
        console.error("monster/stats global query failed:", globalRes.error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const personal = accumulate((personalRes.data ?? []) as StatsRow[]);
    const global = accumulate((globalRes.data ?? []) as StatsRow[]);

    // Distinct item count for the "X / Y collected" progress. Reads from a
    // DB-side distinct view so we don't pull the full opening history into
    // Node just to deduplicate.
    const { data: ownedRows, error: ownedErr } = await supabase
        .from("monster_opening_owned_items")
        .select("item")
        .eq("user_id", user.id)
        .eq("case_type", caseType);

    if (ownedErr) {
        console.error("monster/stats owned-items query failed:", ownedErr.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const ownedItems = (ownedRows ?? []).map((r) => r.item as string);

    // Recent openings for "My recent drops" panel. Bounded to 10 — cheap,
    // served by idx_mo_user_case + in-memory sort on the per-user slice.
    const { data: recentRows, error: recentErr } = await supabase
        .from("monster_opening")
        .select("id, item, rarity, opened_at")
        .eq("user_id", user.id)
        .eq("case_type", caseType)
        .order("opened_at", { ascending: false })
        .limit(10);

    if (recentErr) {
        console.error("monster/stats recent query failed:", recentErr.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const recentItems = (recentRows ?? []).map((r) => ({
        id: r.id as string,
        item: r.item as string,
        rarity: r.rarity as DrinkRarity,
        openedAt: r.opened_at as string,
    }));

    return NextResponse.json({
        personal: {
            total: personal.total,
            byRarity: personal.byRarity,
            ownedItems,
            recentItems,
        },
        global: {
            total: global.total,
            byRarity: global.byRarity,
        },
    });
}
