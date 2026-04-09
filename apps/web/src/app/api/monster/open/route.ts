import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const VALID_RARITIES = new Set(["blue", "purple", "pink", "red", "yellow"]);
const VALID_CASE_TYPES = new Set(["monster", "redbullBurn"]);

const VALID_ITEMS: Record<string, Set<string>> = {
	monster: new Set([
		"Original Zero",
		"Rio Punch",
		"Ultra Paradise",
		"Bad Apple",
		"Ultra Black",
		"Lando Norris",
		"Ultra Gold",
		"Ultra Watermelon",
		"Ultra Rosa",
		"Valentino Rossi",
		"Ultra Fiesta Mango",
		"Original",
		"Full Throttle",
		"Ultra Strawberry Dreams",
		"Aussie Lemonade",
		"Ultra White",
		"Mango Loco",
		"Peachy Keen",
	]),
	redbullBurn: new Set([
		"Burn Fruit Punch",
		"Burn Apple Kiwi",
		"Burn White Citrus",
		"Burn Classic",
		"Red Bull Zero",
		"Red Bull Sugar Free",
		"Red Bull Original",
	]),
};

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

	const { caseType, item, rarity } = body as Record<string, unknown>;

	if (
		typeof caseType !== "string" ||
		typeof item !== "string" ||
		typeof rarity !== "string"
	) {
		return NextResponse.json({ error: "missing_fields" }, { status: 400 });
	}

	if (!VALID_CASE_TYPES.has(caseType)) {
		return NextResponse.json({ error: "invalid_case_type" }, { status: 400 });
	}
	if (!VALID_RARITIES.has(rarity)) {
		return NextResponse.json({ error: "invalid_rarity" }, { status: 400 });
	}
	if (!VALID_ITEMS[caseType]?.has(item)) {
		return NextResponse.json({ error: "invalid_item" }, { status: 400 });
	}

	const { data, error } = await supabase
		.from("monster_opening")
		.insert({
			user_id: user.id,
			case_type: caseType,
			item,
			rarity,
		})
		.select("id, opened_at")
		.single();

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json(data, { status: 201 });
}
