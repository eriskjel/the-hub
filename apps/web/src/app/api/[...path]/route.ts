import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const backend = process.env.BACKEND_URL;
    if (!backend) {
        return NextResponse.json(
            { error: "Server misconfiguration: BACKEND_URL environment variable is not set." },
            { status: 500 }
        );
    }
    const { path: pathParts } = await ctx.params;
    const rawPath = pathParts.join("/");

    // If someone calls /api/backend/widgets/..., they probably meant /api/widgets/...
    // Normalize to ensure Spring gets /api/... (prevents the 404 "static resource" error)
    const apiPath = rawPath.startsWith("api/") ? rawPath : `api/${rawPath}`;

    const targetUrl = `${backend}/${apiPath}${req.nextUrl.search}`;

    // 1) Try auth cookie(s)
    const cookieStore = await cookies();
    let token =
        cookieStore.get("sb-access-token")?.value ?? cookieStore.get("access_token")?.value ?? null;

    // 2) Fallback: Supabase session (works in server routes even if cookie name/path differs)
    if (!token) {
        const supabase = await createClient();
        const {
            data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
    }

    const init: RequestInit = {
        method: req.method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(req.headers.get("content-type")
                ? { "content-type": req.headers.get("content-type")! }
                : {}),
            accept: req.headers.get("accept") ?? "application/json",
        },
        body:
            req.method === "GET" || req.method === "HEAD"
                ? undefined
                : Buffer.from(await req.arrayBuffer()),
        cache: "no-store",
        redirect: "manual",
    };

    const upstream = await fetch(targetUrl, init);

    const buf = await upstream.arrayBuffer();
    const headers = new Headers(upstream.headers);
    if (!headers.get("content-type")) headers.set("content-type", "application/json");

    return new NextResponse(buf, { status: upstream.status, headers });
}

export {
    handler as GET,
    handler as POST,
    handler as PUT,
    handler as PATCH,
    handler as DELETE,
    handler as OPTIONS,
};
