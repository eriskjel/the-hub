import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const instanceId = req.nextUrl.searchParams.get("instanceId");
    if (!instanceId) return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });

    // Let backend resolve instance -> settings; OR pass-through optional overrides (not required)
    const url = new URL(`${backend}/api/widgets/grocery-deals`);
    url.searchParams.set("instanceId", instanceId);

    const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        // optional: short cache
        // next: { revalidate: 60 },
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        return NextResponse.json(
            { error: json.error || "Failed to load deals" },
            { status: response.status }
        );
    }
    return NextResponse.json(json);
}
