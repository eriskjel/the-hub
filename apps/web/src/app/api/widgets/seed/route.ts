import { NextRequest, NextResponse } from "next/server";
import { WidgetListItem } from "@/types/widgets/list";

const CACHE_KEY = "widgets_cache";
const CACHE_TTL_S = 60 * 60 * 24 * 7;

type SlimWidget = Pick<WidgetListItem, "id" | "instanceId" | "kind" | "title" | "grid">;

function isSlimWidgetArray(x: unknown): x is SlimWidget[] {
    if (!Array.isArray(x)) return false;
    return x.every((w) => {
        if (!w || typeof w !== "object") return false;
        const o = w as Record<string, unknown>;
        return (
            typeof o.id === "string" &&
            typeof o.instanceId === "string" &&
            typeof o.kind === "string" &&
            typeof o.title === "string" &&
            typeof o.grid === "object" &&
            o.grid !== null
        );
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    // Accept { slim } (new) or { rows } (legacy) to be safe
    const payload = body?.slim ?? body?.rows;
    if (!isSlimWidgetArray(payload)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(CACHE_KEY, JSON.stringify({ ts: Date.now(), slim: payload, v: 1 }), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: CACHE_TTL_S,
        secure: process.env.NODE_ENV === "production",
    });
    return res;
}
