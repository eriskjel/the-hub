import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkReq } from "@/tests/testUtils";

type User = { id: string } | null;

let mockUser: User = null;
let capturedLimit: number | null = null;

function makeClient() {
    return {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: mockUser } })),
        },
        from: vi.fn((_table: string) => {
            const self: Record<string, unknown> = {};
            (self as { select: () => typeof self }).select = () => self as typeof self;
            (self as { order: () => typeof self }).order = () => self as typeof self;
            (self as { limit: (n: number) => typeof self }).limit = (n: number) => {
                capturedLimit = n;
                return self as typeof self;
            };
            // Terminal: PostgREST returns { data, error } from awaiting the builder.
            (self as { then: Promise<unknown>["then"] }).then = (
                onFulfilled: (v: { data: unknown[]; error: null }) => unknown
            ) => Promise.resolve({ data: [], error: null }).then(onFulfilled);
            return self;
        }),
    };
}

vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => makeClient(),
}));

import { GET } from "../route";

function req(url: string) {
    return mkReq(url);
}

beforeEach(() => {
    mockUser = null;
    capturedLimit = null;
});

describe("GET /api/monster/feed", () => {
    it("returns 401 when unauthenticated", async () => {
        const res = await GET(req("http://localhost:3000/api/monster/feed") as never);
        expect(res.status).toBe(401);
    });

    it("returns 200 with an empty item list when table is empty", async () => {
        mockUser = { id: "user-1" };
        const res = await GET(req("http://localhost:3000/api/monster/feed") as never);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ items: [] });
    });

    it("defaults limit to 20 when not provided", async () => {
        mockUser = { id: "user-1" };
        await GET(req("http://localhost:3000/api/monster/feed") as never);
        expect(capturedLimit).toBe(20);
    });

    it("clamps limit to 50 maximum", async () => {
        mockUser = { id: "user-1" };
        await GET(req("http://localhost:3000/api/monster/feed?limit=500") as never);
        expect(capturedLimit).toBe(50);
    });

    it("falls back to 20 on non-numeric limit", async () => {
        mockUser = { id: "user-1" };
        await GET(req("http://localhost:3000/api/monster/feed?limit=abc") as never);
        expect(capturedLimit).toBe(20);
    });

    it("falls back to 20 on zero or negative limit", async () => {
        mockUser = { id: "user-1" };
        await GET(req("http://localhost:3000/api/monster/feed?limit=-5") as never);
        expect(capturedLimit).toBe(20);
    });
});
