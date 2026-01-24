import { NextRequest, NextResponse } from "next/server";
import { authHeaders, backendUrl, bearerToken, passthroughJson } from "@/server/proxy/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const instanceId = req.nextUrl.searchParams.get("instanceId");
    if (!instanceId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    try {
        const token = await bearerToken();
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const limit = req.nextUrl.searchParams.get("limit");
        const params = new URLSearchParams({ instanceId });
        if (limit) params.set("limit", limit);

        const upstream = await fetch(backendUrl(`/api/widgets/cinemateket?${params.toString()}`), {
            headers: authHeaders(token),
        });

        return passthroughJson(upstream);
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("BACKEND_URL")) {
            return NextResponse.json({ error: "config_missing" }, { status: 500 });
        }
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
}
