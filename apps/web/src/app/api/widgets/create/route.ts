import { NextRequest, NextResponse } from "next/server";
import {
    authHeaders,
    backendUrl,
    bearerToken,
    passthroughJson,
    readJson,
} from "@/server/proxy/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const token = await bearerToken();
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const body = await readJson(req); // unknown (fine for pass-through)
        const upstream = await fetch(backendUrl("/api/widgets"), {
            method: "POST",
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
