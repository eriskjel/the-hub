import { NextRequest, NextResponse } from "next/server";

const CACHE_KEY = "widgets_cache";
const CACHE_TTL_S = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.rows)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: body.rows, v: 1 }), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: CACHE_TTL_S,
        secure: process.env.NODE_ENV === "production",
    });
    return res;
}
