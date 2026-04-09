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

	const parsed = Number(req.nextUrl.searchParams.get("limit") ?? "20");
	const limit = Math.min(
		Number.isFinite(parsed) && parsed > 0 ? parsed : 20,
		50,
	);

	const { data, error } = await supabase
		.from("monster_opening")
		.select(
			`
      id,
      case_type,
      item,
      rarity,
      opened_at,
      profiles(username, full_name, avatar_url)
    `,
		)
		.order("opened_at", { ascending: false })
		.limit(limit);

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	const items = (data ?? []).map((row) => {
		const profile = row.profiles as unknown as {
			username: string | null;
			full_name: string | null;
			avatar_url: string | null;
		};
		return {
			id: row.id,
			caseType: row.case_type,
			item: row.item,
			rarity: row.rarity,
			openedAt: row.opened_at,
			username: profile?.username ?? profile?.full_name ?? "Anonymous",
			avatarUrl: profile?.avatar_url,
		};
	});

	return NextResponse.json({ items });
}
