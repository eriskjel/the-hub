import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    console.log(body)

    const response = await fetch(`${backend}/api/widgets`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    const j = await response.json().catch(() => ({}));
    if (!response.ok)
        return NextResponse.json(
            { error: j.error || "Upstream error" },
            { status: response.status }
        );
    return NextResponse.json(j);
}
