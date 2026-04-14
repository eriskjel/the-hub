import { type NextRequest, NextResponse } from "next/server";
import {
    OPENING_WITH_PROFILE_SELECT,
    toFeedItem,
    type OpeningWithProfileRow,
} from "@/lib/monster/feedRow";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const LOOKBACK_HOURS = 48;
const FETCH_CAP = 500;

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const parsed = Number(req.nextUrl.searchParams.get("limit") ?? "20");
    const limit = Math.min(Math.floor(Number.isFinite(parsed) && parsed > 0 ? parsed : 20), 50);

    // Look back 48h so we always have enough rows to populate `limit` entries
    // after the per-user-per-day dedupe below, even on slow days.
    const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("monster_opening")
        .select(OPENING_WITH_PROFILE_SELECT)
        .gte("opened_at", sinceIso)
        .order("opened_at", { ascending: false })
        .limit(FETCH_CAP);

    if (error) {
        console.error("monster/feed query failed:", error.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as OpeningWithProfileRow[];
    const items = keepFirstOpeningPerUserPerDay(rows).slice(0, limit).map(toFeedItem);

    return NextResponse.json({ items });
}

/**
 * Keep only each user's earliest opening per UTC day. Expects rows newest-first;
 * returns newest-first. Walks oldest→newest so the first occurrence we store
 * for a (user, day) pair is chronologically the first one they opened that day.
 */
function keepFirstOpeningPerUserPerDay(rows: OpeningWithProfileRow[]): OpeningWithProfileRow[] {
    const seen = new Set<string>();
    const firstOfDay: OpeningWithProfileRow[] = [];
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const dayKey = row.opened_at.slice(0, 10); // YYYY-MM-DD UTC
        const key = `${row.user_id}|${dayKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        firstOfDay.push(row);
    }
    return firstOfDay.reverse();
}
