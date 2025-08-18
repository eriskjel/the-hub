import { NextRequest, NextResponse } from "next/server";
import { WidgetListItem } from "@/widgets/rows";
import { getCurrentUserAndProfile } from "@/lib/auth/getProfile.server";
import { widgetsCookieKeyFor } from "@/lib/widgets/cache.server";

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

    // Accept { slim } (new) or { rows } (legacy)
    const slim = body?.slim ?? body?.rows;
    if (!isSlimWidgetArray(slim)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { user } = await getCurrentUserAndProfile();
    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(widgetsCookieKeyFor(user.id), JSON.stringify({ ts: Date.now(), slim, v: 1 }), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: CACHE_TTL_S,
        secure: process.env.NODE_ENV === "production",
    });
    return res;
}
