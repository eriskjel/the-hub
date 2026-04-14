import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkReq } from "@/tests/testUtils";

type User = { id: string } | null;
type Row = {
    id: string;
    user_id: string;
    case_type: string;
    item: string;
    rarity: string;
    opened_at: string;
    profiles: { username: string | null; full_name: string | null; avatar_url: string | null };
};

let mockUser: User = null;
let mockRows: Row[] = [];

function makeClient() {
    return {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: mockUser } })),
        },
        from: vi.fn((_table: string) => {
            const self: Record<string, unknown> = {};
            const passthrough = () => self;
            (self as { select: () => typeof self }).select = passthrough;
            (self as { gte: () => typeof self }).gte = passthrough;
            (self as { order: () => typeof self }).order = passthrough;
            (self as { limit: () => typeof self }).limit = passthrough;
            // Terminal: PostgREST returns { data, error } from awaiting the builder.
            (self as { then: Promise<{ data: Row[]; error: null }>["then"] }).then = (
                onFulfilled,
                onRejected
            ) => Promise.resolve({ data: mockRows, error: null }).then(onFulfilled, onRejected);
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

/** Build N distinct rows — different user_ids, all on the same day, newest-first. */
function seedRows(count: number): Row[] {
    const base = Date.UTC(2026, 3, 13, 12, 0, 0);
    return Array.from({ length: count }, (_, i) => ({
        id: `row-${i}`,
        user_id: `user-${i}`,
        case_type: "monster",
        item: "Mango Loco",
        rarity: "blue",
        opened_at: new Date(base - i * 1000).toISOString(),
        profiles: { username: `u${i}`, full_name: null, avatar_url: null },
    }));
}

beforeEach(() => {
    mockUser = null;
    mockRows = [];
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
        mockRows = seedRows(30);
        const res = await GET(req("http://localhost:3000/api/monster/feed") as never);
        const body = await res.json();
        expect(body.items).toHaveLength(20);
    });

    it("clamps limit to 50 maximum", async () => {
        mockUser = { id: "user-1" };
        mockRows = seedRows(60);
        const res = await GET(req("http://localhost:3000/api/monster/feed?limit=500") as never);
        const body = await res.json();
        expect(body.items).toHaveLength(50);
    });

    it("falls back to 20 on non-numeric limit", async () => {
        mockUser = { id: "user-1" };
        mockRows = seedRows(30);
        const res = await GET(req("http://localhost:3000/api/monster/feed?limit=abc") as never);
        const body = await res.json();
        expect(body.items).toHaveLength(20);
    });

    it("falls back to 20 on zero or negative limit", async () => {
        mockUser = { id: "user-1" };
        mockRows = seedRows(30);
        const res = await GET(req("http://localhost:3000/api/monster/feed?limit=-5") as never);
        const body = await res.json();
        expect(body.items).toHaveLength(20);
    });

    it("dedupes to one opening per user per UTC day, keeping the earliest", async () => {
        mockUser = { id: "user-1" };
        const day = "2026-04-13";
        mockRows = [
            {
                id: "later",
                user_id: "alice",
                case_type: "monster",
                item: "Mango Loco",
                rarity: "blue",
                opened_at: `${day}T15:00:00.000Z`,
                profiles: { username: "alice", full_name: null, avatar_url: null },
            },
            {
                id: "earliest",
                user_id: "alice",
                case_type: "monster",
                item: "Zero Sugar",
                rarity: "blue",
                opened_at: `${day}T08:00:00.000Z`,
                profiles: { username: "alice", full_name: null, avatar_url: null },
            },
        ];
        const res = await GET(req("http://localhost:3000/api/monster/feed") as never);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("earliest");
    });
});
