import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const CACHE_KEY = "widgets_cache";
const CACHE_TTL_S = 60 * 60 * 24 * 7;
const TIMEOUT_MS = 3000;

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${backend}/api/widgets/list`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: ac.signal,
        });

        const text = await res.text();
        const out = new NextResponse(text, {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
        });

        if (res.ok) {
            out.cookies.set(
                CACHE_KEY,
                JSON.stringify({ ts: Date.now(), rows: JSON.parse(text), v: 1 }),
                {
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                    maxAge: CACHE_TTL_S,
                    secure: process.env.NODE_ENV === "production",
                }
            );
        }

        return out;
    } catch {
        return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    } finally {
        clearTimeout(t);
    }
}
