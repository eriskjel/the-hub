import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkReq } from "@/tests/testUtils";

type User = { id: string } | null;

let mockUser: User = null;

function makeClient() {
    return {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: mockUser } })),
        },
        from: vi.fn((table: string) => {
            const self: Record<string, unknown> = {};
            (self as { select: () => typeof self }).select = () => self as typeof self;
            (self as { eq: () => typeof self }).eq = () => self as typeof self;
            (self as { order: () => typeof self }).order = () => self as typeof self;
            (self as { limit: () => typeof self }).limit = () => self as typeof self;

            const result =
                table === "monster_opening_stats"
                    ? {
                          data: [
                              { user_id: "user-1", case_type: "monster", rarity: "blue", count: 8 },
                              {
                                  user_id: "user-1",
                                  case_type: "monster",
                                  rarity: "purple",
                                  count: 2,
                              },
                          ],
                          error: null,
                      }
                    : {
                          data: [
                              { item: "Original Zero", rarity: "blue", opened_at: "2026-04-09T10:00:00Z", id: "a" },
                              { item: "Rio Punch", rarity: "blue", opened_at: "2026-04-09T10:01:00Z", id: "b" },
                          ],
                          error: null,
                      };

            (self as { then: Promise<unknown>["then"] }).then = (
                onFulfilled: (v: unknown) => unknown
            ) => Promise.resolve(result).then(onFulfilled);

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
});

describe("GET /api/monster/stats", () => {
    it("returns 401 when unauthenticated", async () => {
        const res = await GET(req("http://localhost:3000/api/monster/stats") as never);
        expect(res.status).toBe(401);
    });

    it("returns 400 on invalid case type", async () => {
        mockUser = { id: "user-1" };
        const res = await GET(
            req("http://localhost:3000/api/monster/stats?type=nonsense") as never
        );
        expect(res.status).toBe(400);
    });

    it("defaults to monster when no type param is given", async () => {
        mockUser = { id: "user-1" };
        const res = await GET(req("http://localhost:3000/api/monster/stats") as never);
        expect(res.status).toBe(200);
    });

    it("returns personal and global aggregates in the expected shape", async () => {
        mockUser = { id: "user-1" };
        const res = await GET(
            req("http://localhost:3000/api/monster/stats?type=monster") as never
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.personal).toBeDefined();
        expect(body.personal.total).toBe(10);
        expect(body.personal.byRarity.blue).toBe(8);
        expect(body.personal.byRarity.purple).toBe(2);
        expect(Array.isArray(body.personal.ownedItems)).toBe(true);
        expect(Array.isArray(body.personal.recentItems)).toBe(true);
        expect(body.global).toBeDefined();
        expect(body.global.byRarity).toBeDefined();
    });
});
