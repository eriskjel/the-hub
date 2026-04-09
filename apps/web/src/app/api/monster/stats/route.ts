import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const caseType = req.nextUrl.searchParams.get("type") ?? "monster";

    // Personal stats (from DB — supplements localStorage)
    const { data: personal, error: personalErr } = await supabase
        .from("monster_opening")
        .select("rarity, item")
        .eq("user_id", user.id)
        .eq("case_type", caseType);

    if (personalErr) {
        return NextResponse.json({ error: personalErr.message }, { status: 500 });
    }

    // Global stats (all users)
    const { data: global, error: globalErr } = await supabase
        .from("monster_opening")
        .select("rarity")
        .eq("case_type", caseType);

    if (globalErr) {
        return NextResponse.json({ error: globalErr.message }, { status: 500 });
    }

    const countByRarity = (rows: { rarity: string }[] | null) => {
        const counts: Record<string, number> = {
            blue: 0,
            purple: 0,
            pink: 0,
            red: 0,
            yellow: 0,
        };
        for (const row of rows ?? []) {
            counts[row.rarity] = (counts[row.rarity] ?? 0) + 1;
        }
        return counts;
    };

    const personalCounts = countByRarity(personal);
    const globalCounts = countByRarity(global);
    const personalTotal = personal?.length ?? 0;
    const globalTotal = global?.length ?? 0;

    const uniqueItems = new Set(
        (personal ?? []).map((r) => (r as { rarity: string; item: string }).item)
    ).size;

    return NextResponse.json({
        personal: {
            total: personalTotal,
            byRarity: personalCounts,
            uniqueItems,
        },
        global: { total: globalTotal, byRarity: globalCounts },
    });
}
