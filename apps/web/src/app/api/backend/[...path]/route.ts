import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { backendBase } from "@/server/proxy/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendCtx = { params: Promise<{ path: string[] }> };

function buildApiUrl(base: string, pathParts: string[], search: string): string {
    const clean = (pathParts ?? []).join("/");
    const apiPath = clean.startsWith("api/") ? clean : `api/${clean}`;
    const url = new URL(apiPath, base.endsWith("/") ? base : `${base}/`);
    url.search = search;
    return url.toString();
}

async function proxy(req: NextRequest, ctx: BackendCtx) {
    let base: string;
    try {
        base = backendBase();
    } catch {
        return NextResponse.json({ error: "config_missing" }, { status: 500 });
    }

    const { path } = await ctx.params;
    const url = buildApiUrl(base, path ?? [], req.nextUrl.search);

    // Try cookie first (cheap), then Supabase session as fallback
    const jar = await cookies();
    let token = jar.get("sb-access-token")?.value ?? jar.get("access_token")?.value ?? null;

    if (!token) {
        const supabase = await createClient();
        const {
            data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
    }

    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const ct = req.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    headers.set("accept", req.headers.get("accept") ?? "application/json");
    for (const h of ["x-forwarded-for", "x-forwarded-proto", "x-real-ip"]) {
        const v = req.headers.get(h);
        if (v) headers.set(h, v);
    }

    const body =
        req.method === "GET" || req.method === "HEAD"
            ? undefined
            : Buffer.from(await req.arrayBuffer());

    const upstream = await fetch(url, {
        method: req.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
    });

    const status = upstream.status;
    const respHeaders = new Headers(upstream.headers);

    // 204/304 MUST NOT have a body; drop content-type for safety
    if (status === 204 || status === 304) {
        respHeaders.delete("content-type");
        return new NextResponse(null, { status, headers: respHeaders });
    }

    if (!respHeaders.get("content-type")) {
        respHeaders.set("content-type", "application/json");
    }

    return new NextResponse(upstream.body, {
        status,
        headers: respHeaders,
    });
}

export async function GET(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: BackendCtx) {
    return proxy(req, ctx);
}
