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

    const response = await fetch(`${backend}/api/widgets`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
        let message = json.error || "Failed to create widget";
        if (response.status === 401) message = "You need to sign in to create a widget.";
        else if (response.status === 403) message = "You’re not allowed to create widgets.";
        else if (response.status === 409 && json.error === "duplicate_target")
            message = "That URL is already used by one of your widgets.";

        return NextResponse.json({ error: message }, { status: response.status });
    }
    return NextResponse.json(json);
}
