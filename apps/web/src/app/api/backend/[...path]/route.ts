import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendCtx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: BackendCtx) {
    const backend = process.env.BACKEND_URL;
    if (!backend) {
        return NextResponse.json(
            { error: "Server misconfiguration: BACKEND_URL is not set." },
            { status: 500 }
        );
    }

    const { path } = await ctx.params;
    const clean = (path ?? []).join("/").replace(/^\/+/, "");
    const apiPath = clean.startsWith("api/") ? clean : `api/${clean}`;

    const base = backend.endsWith("/") ? backend : backend + "/";
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/+$/, "") + "/" + apiPath.replace(/^\/+/, "");
    url.search = req.nextUrl.search;

    // Cookies is sync in route handlers
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

    const upstream = await fetch(url.toString(), {
        method: req.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
    });

    const respHeaders = new Headers(upstream.headers);
    if (!respHeaders.get("content-type")) {
        respHeaders.set("content-type", "application/json");
    }

    return new NextResponse(upstream.body, {
        status: upstream.status,
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
