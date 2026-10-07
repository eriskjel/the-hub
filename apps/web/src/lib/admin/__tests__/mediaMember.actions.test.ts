import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the admin action that grants, edits and revokes request access.
 * requireAdmin and the service-role client are mocked; the fake client records
 * every write so the tests can assert exactly what reaches media_member.
 */

const ADMIN_ID = "00000000-0000-0000-0000-0000000000a1";
const USER_ID = "00000000-0000-0000-0000-0000000000b1";

type Write = {
    op: "update" | "upsert";
    payload: Record<string, unknown>;
    filters: string[];
    options?: Record<string, unknown>;
};

let isAdmin = true;
let targetUser: { id: string; app_metadata: Record<string, unknown> } | null = null;
// The user's media_member row as the database has it, or null for none.
let existingRow: { revoked_at: string | null } | null = null;
let writeError: { code: string; message: string } | null = null;
let writes: Write[] = [];

// vi.mock factories are hoisted above this file's declarations, so the mocks
// they hand out are created with vi.hoisted and wired up below.
const { requireAdminMock, refreshMock, createAdminClientMock } = vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    refreshMock: vi.fn(),
    createAdminClientMock: vi.fn(),
}));

function requireAdminImpl() {
    if (!isAdmin) throw new Error("REDIRECT:/dashboard?denied=admin");
    return { user: { id: ADMIN_ID } };
}

function fakeAdminClient() {
    return {
        auth: {
            admin: {
                getUserById: vi.fn(async () =>
                    targetUser
                        ? { data: { user: targetUser }, error: null }
                        : {
                              data: { user: null },
                              error: { status: 404, message: "User not found" },
                          }
                ),
            },
        },
        from: vi.fn((table: string) => {
            expect(table).toBe("media_member");
            return {
                update: (payload: Record<string, unknown>) => filteredUpdate(payload),
                upsert: (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
                    writes.push({ op: "upsert", payload, filters: [], options });
                    return {
                        // An existing row is skipped only when duplicates are ignored.
                        select: async () =>
                            writeError
                                ? { data: null, error: writeError }
                                : {
                                      data:
                                          existingRow && options?.ignoreDuplicates
                                              ? []
                                              : [{ user_id: USER_ID }],
                                      error: null,
                                  },
                    };
                },
            };
        }),
    };
}

/**
 * An update builder like supabase-js: records .eq()/.is()/.not() filters, and
 * .select() returns the rows that matched: `revoked_at is null` matches only an
 * active row, `revoked_at not is null` only a revoked one.
 */
function filteredUpdate(payload: Record<string, unknown>) {
    const write: Write = { op: "update", payload, filters: [] };
    writes.push(write);
    const builder = {
        eq: (k: string, v: unknown) => {
            write.filters.push(`${k}=${String(v)}`);
            return builder;
        },
        is: (k: string, v: unknown) => {
            write.filters.push(`${k} is ${String(v)}`);
            return builder;
        },
        not: (k: string, op: string, v: unknown) => {
            write.filters.push(`${k} not ${op} ${String(v)}`);
            return builder;
        },
        select: async () => {
            if (writeError) return { data: null, error: writeError };
            const active = existingRow?.revoked_at === null;
            const matches =
                existingRow &&
                (write.filters.includes("revoked_at is null")
                    ? active
                    : write.filters.includes("revoked_at not is null")
                      ? !active
                      : true);
            return { data: matches ? [{ user_id: USER_ID }] : [], error: null };
        },
    };
    return builder;
}

vi.mock("@/lib/auth/requireAdmin.server", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("next/cache", () => ({ refresh: refreshMock, revalidatePath: vi.fn() }));

// Import AFTER the mock declarations
import { mediaMemberAction } from "../mediaMember.actions";

const IDLE = { status: "idle" } as const;
const ACTIVE = { revoked_at: null };
const REVOKED = { revoked_at: "2026-10-01T00:00:00Z" };

function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
}

function memberForm(intent: string, overrides: Record<string, string> = {}): FormData {
    return form({
        intent,
        userId: USER_ID,
        libraryAccount: "fredrik",
        weeklyQuota: "5",
        ...overrides,
    });
}

const grant = (overrides?: Record<string, string>) =>
    mediaMemberAction(IDLE, memberForm("grant", overrides));
const update = (overrides?: Record<string, string>) =>
    mediaMemberAction(IDLE, memberForm("update", overrides));
const revoke = (userId = USER_ID) => mediaMemberAction(IDLE, form({ intent: "revoke", userId }));

beforeEach(() => {
    isAdmin = true;
    targetUser = { id: USER_ID, app_metadata: { role: "user" } };
    existingRow = null;
    writeError = null;
    writes = [];
    requireAdminMock.mockReset().mockImplementation(async () => requireAdminImpl());
    refreshMock.mockReset();
    createAdminClientMock.mockReset().mockImplementation(fakeAdminClient);
});

describe("mediaMemberAction", () => {
    it.each(["grant", "update", "revoke"])(
        "rejects non-admins before touching the database (%s)",
        async (intent) => {
            isAdmin = false;
            await expect(mediaMemberAction(IDLE, memberForm(intent))).rejects.toThrow("REDIRECT");
            expect(createAdminClientMock).not.toHaveBeenCalled();
        }
    );

    it("rejects an unknown intent", async () => {
        const state = await mediaMemberAction(IDLE, memberForm("delete"));

        expect(state).toEqual({ status: "error", error: "failed" });
        expect(createAdminClientMock).not.toHaveBeenCalled();
    });

    describe("grant", () => {
        it("creates a membership for a new member", async () => {
            const state = await grant({ libraryAccount: " fredrik " });

            expect(state).toEqual({ status: "saved" });
            expect(writes.map((w) => w.op)).toEqual(["update", "upsert"]);
            // No revoked row to reactivate...
            expect(writes[0].filters).toEqual([`user_id=${USER_ID}`, "revoked_at not is null"]);
            // ...so insert, leaving any existing row alone.
            expect(writes[1].options).toEqual({ onConflict: "user_id", ignoreDuplicates: true });
            expect(writes[1].payload).toMatchObject({
                user_id: USER_ID,
                library_account: "fredrik",
                weekly_quota: 5,
                granted_by: ADMIN_ID,
                revoked_at: null,
            });
            expect(typeof writes[1].payload.granted_at).toBe("string");
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("turns a revoked member's row into a fresh grant", async () => {
            existingRow = REVOKED;
            const state = await grant();

            expect(state).toEqual({ status: "saved" });
            expect(writes).toHaveLength(1);
            expect(writes[0].op).toBe("update");
            expect(writes[0].filters).toEqual([`user_id=${USER_ID}`, "revoked_at not is null"]);
            expect(writes[0].payload).toMatchObject({
                library_account: "fredrik",
                granted_by: ADMIN_ID,
                revoked_at: null,
            });
        });

        it("never overwrites an active membership, and says so", async () => {
            existingRow = ACTIVE;
            const state = await grant({ libraryAccount: "someone-else", weeklyQuota: "50" });

            expect(state).toEqual({ status: "error", error: "already_active" });
            expect(writes.map((w) => w.op)).toEqual(["update", "upsert"]);
            expect(writes[1].options).toMatchObject({ ignoreDuplicates: true });
            // The card re-renders with the current (active) state.
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("lets an admin have access without a library account", async () => {
            targetUser = { id: USER_ID, app_metadata: { roles: ["admin"] } };
            const state = await grant({ libraryAccount: "" });

            expect(state).toEqual({ status: "saved" });
            expect(writes.at(-1)?.payload).toMatchObject({ library_account: null });
        });

        it("reports a library account that is already linked", async () => {
            writeError = { code: "23505", message: "duplicate key value" };
            const state = await grant();

            expect(state).toEqual({ status: "error", error: "account_taken" });
            expect(refreshMock).not.toHaveBeenCalled();
        });
    });

    describe("update", () => {
        it("edits an active member in one conditional write, keeping their grant", async () => {
            existingRow = ACTIVE;
            const state = await update({ libraryAccount: "fredrik2", weeklyQuota: "10" });

            expect(state).toEqual({ status: "saved" });
            expect(writes).toEqual([
                {
                    op: "update",
                    payload: { library_account: "fredrik2", weekly_quota: 10 },
                    filters: [`user_id=${USER_ID}`, "revoked_at is null"],
                },
            ]);
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("changes nothing once access has been revoked, and says so", async () => {
            existingRow = REVOKED;
            const state = await update();

            expect(state).toEqual({ status: "error", error: "not_active" });
            expect(writes.map((w) => w.op)).toEqual(["update"]);
            // The card re-renders with the current (revoked) state.
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("never grants access to someone without a membership", async () => {
            const state = await update();

            expect(state).toEqual({ status: "error", error: "not_active" });
            expect(writes.some((w) => w.op === "upsert")).toBe(false);
        });

        it("reports a library account that is already linked", async () => {
            existingRow = ACTIVE;
            writeError = { code: "23505", message: "duplicate key value" };
            const state = await update();

            expect(state).toEqual({ status: "error", error: "account_taken" });
        });
    });

    describe("validation (grant and update)", () => {
        it.each(["grant", "update"])(
            "requires a library account for users who aren't admins (%s)",
            async (intent) => {
                existingRow = ACTIVE;
                const state = await mediaMemberAction(
                    IDLE,
                    memberForm(intent, { libraryAccount: "  " })
                );

                expect(state).toEqual({ status: "error", error: "account_required" });
                expect(writes).toHaveLength(0);
            }
        );

        it.each(["eve smith", "a/b", "x".repeat(65), "ålesund"])(
            "rejects the library account %j",
            async (libraryAccount) => {
                const state = await grant({ libraryAccount });

                expect(state).toEqual({ status: "error", error: "invalid_account" });
                expect(writes).toHaveLength(0);
            }
        );

        it.each(["", "-1", "2.5", "51", "1e1", "abc"])(
            "rejects the quota %j",
            async (weeklyQuota) => {
                const state = await grant({ weeklyQuota });

                expect(state).toEqual({ status: "error", error: "invalid_quota" });
                expect(writes).toHaveLength(0);
            }
        );

        it("accepts the quota bounds", async () => {
            expect(await grant({ weeklyQuota: "0" })).toEqual({ status: "saved" });
            expect(await grant({ weeklyQuota: "50" })).toEqual({ status: "saved" });
        });

        it("reports an unknown user", async () => {
            targetUser = null;
            const state = await grant();

            expect(state).toEqual({ status: "error", error: "not_found" });
            expect(writes).toHaveLength(0);
        });

        it("rejects a user id that isn't a uuid", async () => {
            const state = await grant({ userId: "1 or 1=1" });

            expect(state).toEqual({ status: "error", error: "not_found" });
            expect(createAdminClientMock).not.toHaveBeenCalled();
        });
    });

    describe("revoke", () => {
        it("revokes an active membership and keeps the row", async () => {
            existingRow = ACTIVE;
            const state = await revoke();

            expect(state).toEqual({ status: "revoked" });
            expect(writes).toHaveLength(1);
            expect(writes[0].op).toBe("update");
            expect(Object.keys(writes[0].payload)).toEqual(["revoked_at"]);
            expect(writes[0].filters).toEqual([`user_id=${USER_ID}`, "revoked_at is null"]);
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it.each([
            ["already revoked", REVOKED],
            ["never a member", null],
        ])("reports when there was nothing to revoke (%s)", async (_label, row) => {
            existingRow = row;
            const state = await revoke();

            expect(state).toEqual({ status: "error", error: "not_active" });
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("rejects a user id that isn't a uuid", async () => {
            const state = await revoke("nope");

            expect(state).toEqual({ status: "error", error: "not_found" });
            expect(createAdminClientMock).not.toHaveBeenCalled();
        });
    });
});
