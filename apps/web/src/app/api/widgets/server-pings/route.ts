import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const instanceId = req.nextUrl.searchParams.get("instanceId");
    if (!instanceId) {
        return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });

    let res: Response;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 2500);
    try {
        res = await fetch(
            `${backend}/api/widgets/server-pings?instanceId=${encodeURIComponent(instanceId)}`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
                signal: ac.signal,
            }
        );
    } catch {
        return NextResponse.json(
            { status: "degraded", error: "backend_unreachable" },
            { status: 503 }
        );
    } finally {
        clearTimeout(timeout);
    }

    const text = await res.text();
    return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
}
