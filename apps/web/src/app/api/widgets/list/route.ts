import { NextRequest, NextResponse } from "next/server";
import { authHeaders, backendUrl, bearerToken, withTimeout } from "@/server/proxy/utils";

const CACHE_KEY = "widgets_cache";
const CACHE_TTL_S = 60 * 60 * 24 * 7; // 7 days
const TIMEOUT_MS = 3000;

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    try {
        const token = await bearerToken();
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const timeout = withTimeout(TIMEOUT_MS);
        try {
            const upstream = await fetch(backendUrl("/api/widgets/list"), {
                headers: authHeaders(token),
                cache: "no-store",
                signal: timeout.signal,
            });

            // Pass through raw text and content-type (like before)
            const text = await upstream.text();
            const out = new NextResponse(text, {
                status: upstream.status,
                headers: {
                    "content-type": upstream.headers.get("content-type") ?? "application/json",
                },
            });

            // If OK, set cache cookie (best-effort JSON parse)
            if (upstream.ok) {
                try {
                    const rows = JSON.parse(text);
                    out.cookies.set(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows, v: 1 }), {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                        maxAge: CACHE_TTL_S,
                        secure: process.env.NODE_ENV === "production",
                    });
                } catch {
                    // If upstream returns non-JSON (unexpected), skip cookie
                }
            }

            return out;
        } finally {
            timeout.clear();
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("BACKEND_URL")) {
            return NextResponse.json({ error: "config_missing" }, { status: 500 });
        }
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
}
