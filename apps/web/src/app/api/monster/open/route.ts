import { type NextRequest, NextResponse } from "next/server";
import { isCaseKey } from "@/lib/monster/catalog";
import { rollCase } from "@/lib/monster/roll";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs"; // node:crypto is needed for the server roll
export const dynamic = "force-dynamic";

/**
 * Minimum gap between two openings from the same user, in milliseconds.
 * Protects against rapid-fire scripts without being annoying to a human
 * clicking the button.
 */
const RATE_LIMIT_MS = 1000;

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const caseType = (body as { caseType?: unknown } | null)?.caseType;
    if (!isCaseKey(caseType)) {
        return NextResponse.json({ error: "invalid_case_type" }, { status: 400 });
    }

    // Rate limit: reject if the user opened anything in the last RATE_LIMIT_MS.
    // One short query against idx_mo_user_case. Not atomic — a determined
    // attacker could beat the race — but it caps casual scripts effectively.
    const { data: lastRow, error: lastErr } = await supabase
        .from("monster_opening")
        .select("opened_at")
        .eq("user_id", user.id)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastErr) {
        console.error("monster/open rate-limit check failed:", lastErr.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    if (lastRow) {
        const elapsed = Date.now() - new Date(lastRow.opened_at).getTime();
        if (elapsed < RATE_LIMIT_MS) {
            const retryAfterMs = RATE_LIMIT_MS - elapsed;
            return NextResponse.json(
                { error: "rate_limited", retryAfterMs },
                {
                    status: 429,
                    headers: {
                        "retry-after": String(Math.ceil(retryAfterMs / 1000)),
                    },
                }
            );
        }
    }

    // Authoritative roll on the server — the client cannot influence the outcome.
    const roll = rollCase(caseType);

    const { data: inserted, error: insertErr } = await supabase
        .from("monster_opening")
        .insert({
            user_id: user.id,
            case_type: caseType,
            item: roll.item,
            rarity: roll.rarity,
        })
        .select("id, opened_at")
        .single();

    if (insertErr) {
        console.error("monster/open insert failed:", insertErr.message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    return NextResponse.json(
        {
            id: inserted.id,
            caseType,
            item: roll.item,
            rarity: roll.rarity,
            image: roll.image,
            openedAt: inserted.opened_at,
        },
        { status: 201 }
    );
}
