import { NextRequest, NextResponse } from "next/server";
import { authHeaders, backendUrl, bearerToken, passthroughText, withTimeout, } from "@/server/proxy/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const instanceId = req.nextUrl.searchParams.get("instanceId");
    if (!instanceId) {
        return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });
    }

    try {
        const token = await bearerToken();
        if (!token) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const t = withTimeout(2500);
        try {
            const upstream = await fetch(backendUrl("/api/widgets/server-pings", { instanceId }), {
                headers: authHeaders(token),
                cache: "no-store",
                signal: t.signal,
            });
            return passthroughText(upstream);
        } finally {
            t.clear();
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("BACKEND_URL")) {
            return NextResponse.json({ error: "config_missing" }, { status: 500 });
        }
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
}
