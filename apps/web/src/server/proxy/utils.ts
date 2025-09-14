import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** JSON types */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [k: string]: JsonValue } | JsonValue[];

/** BACKEND_URL (throws if missing) */
export function backendBase(): string {
    const raw = process.env.BACKEND_URL?.trim();
    if (!raw) throw new Error("BACKEND_URL not set");
    return raw.replace(/\/+$/, "");
}

/** Supabase bearer token (or null) */
export async function bearerToken(): Promise<string | null> {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

/** Build backend URL + optional query */
export function backendUrl(
    path: string,
    query?: Record<string, string | number | undefined | null>
): string {
    const u = new URL(backendBase() + (path.startsWith("/") ? path : `/${path}`));
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
        }
    }
    return u.toString();
}

/** Authorization header + extras */
export function authHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
    const h = new Headers(extra ?? {});
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
}

/** Read request JSON safely (typed as unknown) */
export async function readJson(req: NextRequest): Promise<unknown> {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

export async function passthroughJson(upstream: Response): Promise<NextResponse> {
    const status = upstream.status;

    // 204/304 MUST NOT include a body
    if (status === 204 || status === 304) {
        const headers = new Headers(upstream.headers);
        headers.delete("content-type"); // be safe
        return new NextResponse(null, { status, headers });
    }

    const isJson = upstream.headers.get("content-type")?.includes("application/json");
    const body: unknown = isJson ? await upstream.json().catch(() => ({})) : {};
    return NextResponse.json<unknown>(body, { status });
}

export async function passthroughText(upstream: Response): Promise<NextResponse> {
    const status = upstream.status;

    // 204/304 MUST NOT include a body
    if (status === 204 || status === 304) {
        const headers = new Headers(upstream.headers);
        headers.delete("content-type");
        return new NextResponse(null, { status, headers });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
        status,
        headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
}

/** AbortController helper (no any) */
export function withTimeout(ms: number) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    return { signal: ac.signal, clear: () => clearTimeout(timer) };
}
