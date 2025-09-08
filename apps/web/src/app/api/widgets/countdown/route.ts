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

    const url = new URL(`${backend}/api/widgets/countdown`);
    url.searchParams.set("instanceId", instanceId);

    const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return NextResponse.json(
            { error: json.error || "Failed to load countdown" },
            { status: resp.status }
        );
    }
    return NextResponse.json(json);
}
