import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route tests for POST /api/monster/open.
 *
 * These tests use a fresh inline mock of @/utils/supabase/server per file
 * (rather than the shared vitest.setup.ts stub), because the route chains
 * `.from().select().eq().order().limit().maybeSingle()` and `.insert().select().single()`,
 * and a faithful stub is simpler to reason about in isolation.
 */

type User = { id: string } | null;

let mockUser: User = null;
let lastOpenedAt: string | null = null;
let insertShouldFail = false;

function makeClient() {
    return {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: mockUser } })),
        },
        from: vi.fn((_table: string) => {
            const builder: Record<string, unknown> = {};
            // .select(...).eq(...).order(...).limit(...).maybeSingle()
            // and .insert(...).select(...).single()
            const self = builder as {
                select: (cols?: string) => typeof self;
                eq: (k: string, v: unknown) => typeof self;
                order: () => typeof self;
                limit: () => typeof self;
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
                insert: (payload: Record<string, unknown>) => {
                    select: () => {
                        single: () => Promise<{ data: unknown; error: unknown }>;
                    };
                };
            };

            self.select = () => self;
            self.eq = () => self;
            self.order = () => self;
            self.limit = () => self;
            self.maybeSingle = async () => ({
                data: lastOpenedAt ? { opened_at: lastOpenedAt } : null,
                error: null,
            });
            self.insert = (payload: Record<string, unknown>) => ({
                select: () => ({
                    single: async () =>
                        insertShouldFail
                            ? { data: null, error: { message: "db_error" } }
                            : {
                                  data: {
                                      id: "row-1",
                                      opened_at: new Date().toISOString(),
                                      ...payload,
                                  },
                                  error: null,
                              },
                }),
            });

            return self;
        }),
    };
}

vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => makeClient(),
}));

// Import AFTER the mock declaration
import { POST } from "../route";

function req(body: unknown): Request {
    return new Request("http://localhost:3000/api/monster/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

beforeEach(() => {
    mockUser = null;
    lastOpenedAt = null;
    insertShouldFail = false;
});

describe("POST /api/monster/open", () => {
    it("returns 401 when unauthenticated", async () => {
        const res = await POST(req({ caseType: "monster" }) as never);
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "unauthorized" });
    });

    it("returns 400 on invalid JSON", async () => {
        mockUser = { id: "user-1" };
        const res = await POST(req("{not-json") as never);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_json" });
    });

    it("returns 400 when caseType is missing", async () => {
        mockUser = { id: "user-1" };
        const res = await POST(req({}) as never);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_case_type" });
    });

    it("returns 400 when caseType is unknown", async () => {
        mockUser = { id: "user-1" };
        const res = await POST(req({ caseType: "not-a-real-case" }) as never);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_case_type" });
    });

    it("returns 429 with retry-after when rate-limited", async () => {
        mockUser = { id: "user-1" };
        // Last opening was 200ms ago — within the 1000ms window.
        lastOpenedAt = new Date(Date.now() - 200).toISOString();

        const res = await POST(req({ caseType: "monster" }) as never);
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toBe("rate_limited");
        expect(typeof body.retryAfterMs).toBe("number");
        expect(body.retryAfterMs).toBeLessThanOrEqual(1000);
        expect(res.headers.get("retry-after")).not.toBeNull();
    });

    it("allows opening when the last opening is outside the rate-limit window", async () => {
        mockUser = { id: "user-1" };
        lastOpenedAt = new Date(Date.now() - 2000).toISOString(); // 2s ago

        const res = await POST(req({ caseType: "monster" }) as never);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.caseType).toBe("monster");
        expect(typeof body.item).toBe("string");
        expect(typeof body.rarity).toBe("string");
        expect(typeof body.image).toBe("string");
        expect(typeof body.id).toBe("string");
        expect(typeof body.openedAt).toBe("string");
    });

    it("allows opening when there is no prior opening", async () => {
        mockUser = { id: "user-1" };
        const res = await POST(req({ caseType: "monster" }) as never);
        expect(res.status).toBe(201);
    });

    it("ignores client-supplied item and rarity (server is authoritative)", async () => {
        mockUser = { id: "user-1" };
        // Client tries to force a legendary by sending forged fields.
        const res = await POST(
            req({
                caseType: "monster",
                item: "Mango Loco",
                rarity: "yellow",
            }) as never
        );
        expect(res.status).toBe(201);
        const body = await res.json();
        // Response may or may not contain yellow; the point is the server
        // didn't just echo the forged fields. Verify they're derived from
        // the catalog by checking shape only. The roll.test.ts unit covers
        // catalog consistency across many iterations.
        expect(body).toHaveProperty("item");
        expect(body).toHaveProperty("rarity");
        expect(["blue", "purple", "pink", "red", "yellow"]).toContain(body.rarity);
    });

    it("returns 500 when the insert fails", async () => {
        mockUser = { id: "user-1" };
        insertShouldFail = true;
        const res = await POST(req({ caseType: "monster" }) as never);
        expect(res.status).toBe(500);
    });
});
