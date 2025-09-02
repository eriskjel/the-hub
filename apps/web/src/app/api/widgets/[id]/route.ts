import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params; // await dynamic params

    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const res = await fetch(`${backend}/api/widgets/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204) return NextResponse.json({ ok: true });

    // Parse JSON only when present and of correct type
    let body: unknown = null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
        body = await res.json().catch(() => null);
    }

    if (!res.ok) {
        let message = "Failed to delete widget";
        if (isRecord(body) && typeof body.error === "string") message = body.error;
        if (res.status === 401) message = "You need to sign in to delete a widget.";
        else if (res.status === 403) message = "You’re not allowed to delete this widget.";
        else if (res.status === 404) message = "Widget not found.";

        return NextResponse.json({ error: message }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params; // await dynamic params
    const backend = process.env.BACKEND_URL;
    if (!backend) return NextResponse.json({ error: "BACKEND_URL not set" }, { status: 500 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // server-side log (shows in your Node terminal)
    console.log("[PATCH /api/widgets/:id] params.id=", id);

    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    console.log("[PATCH /api/widgets/:id] body=", body);

    const response = await fetch(`${backend}/api/widgets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    // Try to parse JSON if present
    const ct = response.headers.get("content-type") ?? "";
    const json = ct.includes("application/json") ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
        let message =
            (isRecord(json) && typeof json.error === "string" && json.error) ||
            "Failed to update widget";
        if (response.status === 401) message = "You need to sign in to edit widgets.";
        else if (response.status === 403) message = "You’re not allowed to edit this widget.";
        return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(json);
}
