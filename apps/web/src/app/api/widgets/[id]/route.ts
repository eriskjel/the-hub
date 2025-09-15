import { NextRequest, NextResponse } from "next/server";
import {
    authHeaders,
    backendUrl,
    bearerToken,
    passthroughJson,
    readJson,
} from "@/server/proxy/utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    try {
        const token = await bearerToken();
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const upstream = await fetch(backendUrl(`/api/widgets/${encodeURIComponent(id)}`), {
            method: "DELETE",
            headers: authHeaders(token),
            cache: "no-store",
        });

        // Pass status + JSON ({} if empty)
        return passthroughJson(upstream);
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("BACKEND_URL")) {
            return NextResponse.json({ error: "config_missing" }, { status: 500 });
        }
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    try {
        const token = await bearerToken();
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const body = await readJson(req);
        const upstream = await fetch(backendUrl(`/api/widgets/${encodeURIComponent(id)}`), {
            method: "PATCH",
            headers: authHeaders(token, { "content-type": "application/json" }),
            body: JSON.stringify(body),
            cache: "no-store",
        });

        return passthroughJson(upstream);
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("BACKEND_URL")) {
            return NextResponse.json({ error: "config_missing" }, { status: 500 });
        }
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
}
