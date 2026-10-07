import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the admin action that grants, edits and revokes request access.
 * requireAdmin and the service-role client are mocked; the fake client records
 * every write so the tests can assert exactly what reaches media_member.
 */

const ADMIN_ID = "00000000-0000-0000-0000-0000000000a1";
const USER_ID = "00000000-0000-0000-0000-0000000000b1";

type Write = { op: "update" | "upsert"; payload: Record<string, unknown>; filters: string[] };

let isAdmin = true;
let targetUser: { id: string; app_metadata: Record<string, unknown> } | null = null;
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
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({ data: existingRow, error: null }),
                    }),
                }),
                update: (payload: Record<string, unknown>) => filtered("update", payload),
                upsert: async (payload: Record<string, unknown>) => {
                    writes.push({ op: "upsert", payload, filters: [] });
                    return { error: writeError };
                },
            };
        }),
    };
}

/** An awaitable builder that records .eq()/.is() filters, like supabase-js. */
function filtered(op: Write["op"], payload: Record<string, unknown>) {
    const write: Write = { op, payload, filters: [] };
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
        then: (resolve: (r: { error: typeof writeError }) => unknown) =>
            resolve({ error: writeError }),
    };
    return builder;
}

vi.mock("@/lib/auth/requireAdmin.server", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("next/cache", () => ({ refresh: refreshMock, revalidatePath: vi.fn() }));

// Import AFTER the mock declarations
import { mediaMemberAction } from "../mediaMember.actions";

const IDLE = { status: "idle" } as const;

function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
}

function saveForm(overrides: Record<string, string> = {}): FormData {
    return form({
        intent: "save",
        userId: USER_ID,
        libraryAccount: "fredrik",
        weeklyQuota: "5",
        ...overrides,
    });
}

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
    it("rejects non-admins before touching the database", async () => {
        isAdmin = false;
        await expect(mediaMemberAction(IDLE, saveForm())).rejects.toThrow("REDIRECT");
        await expect(
            mediaMemberAction(IDLE, form({ intent: "revoke", userId: USER_ID }))
        ).rejects.toThrow("REDIRECT");
        expect(createAdminClientMock).not.toHaveBeenCalled();
    });

    it("grants access to a new member", async () => {
        const state = await mediaMemberAction(IDLE, saveForm({ libraryAccount: " fredrik " }));

        expect(state).toEqual({ status: "saved" });
        expect(writes).toHaveLength(1);
        expect(writes[0].op).toBe("upsert");
        expect(writes[0].payload).toMatchObject({
            user_id: USER_ID,
            library_account: "fredrik",
            weekly_quota: 5,
            granted_by: ADMIN_ID,
            revoked_at: null,
        });
        expect(typeof writes[0].payload.granted_at).toBe("string");
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("re-grants a revoked member as a fresh grant", async () => {
        existingRow = { revoked_at: "2026-10-01T00:00:00Z" };
        const state = await mediaMemberAction(IDLE, saveForm());

        expect(state).toEqual({ status: "saved" });
        expect(writes[0].op).toBe("upsert");
        expect(writes[0].payload).toMatchObject({ granted_by: ADMIN_ID, revoked_at: null });
    });

    it("edits an active member without resetting their grant", async () => {
        existingRow = { revoked_at: null };
        const state = await mediaMemberAction(
            IDLE,
            saveForm({ libraryAccount: "fredrik2", weeklyQuota: "10" })
        );

        expect(state).toEqual({ status: "saved" });
        expect(writes).toEqual([
            {
                op: "update",
                payload: { library_account: "fredrik2", weekly_quota: 10 },
                filters: [`user_id=${USER_ID}`],
            },
        ]);
    });

    it("requires a library account for users who aren't admins", async () => {
        const state = await mediaMemberAction(IDLE, saveForm({ libraryAccount: "  " }));

        expect(state).toEqual({ status: "error", error: "account_required" });
        expect(writes).toHaveLength(0);
    });

    it("lets an admin have access without a library account", async () => {
        targetUser = { id: USER_ID, app_metadata: { roles: ["admin"] } };
        const state = await mediaMemberAction(IDLE, saveForm({ libraryAccount: "" }));

        expect(state).toEqual({ status: "saved" });
        expect(writes[0].payload).toMatchObject({ library_account: null });
    });

    it.each(["eve smith", "a/b", "x".repeat(65), "ålesund"])(
        "rejects the library account %j",
        async (libraryAccount) => {
            const state = await mediaMemberAction(IDLE, saveForm({ libraryAccount }));

            expect(state).toEqual({ status: "error", error: "invalid_account" });
            expect(writes).toHaveLength(0);
        }
    );

    it.each(["", "-1", "2.5", "51", "1e1", "abc"])("rejects the quota %j", async (weeklyQuota) => {
        const state = await mediaMemberAction(IDLE, saveForm({ weeklyQuota }));

        expect(state).toEqual({ status: "error", error: "invalid_quota" });
        expect(writes).toHaveLength(0);
    });

    it("accepts the quota bounds", async () => {
        expect(await mediaMemberAction(IDLE, saveForm({ weeklyQuota: "0" }))).toEqual({
            status: "saved",
        });
        expect(await mediaMemberAction(IDLE, saveForm({ weeklyQuota: "50" }))).toEqual({
            status: "saved",
        });
    });

    it("reports a library account that is already linked", async () => {
        writeError = { code: "23505", message: "duplicate key value" };
        const state = await mediaMemberAction(IDLE, saveForm());

        expect(state).toEqual({ status: "error", error: "account_taken" });
        expect(refreshMock).not.toHaveBeenCalled();
    });

    it("reports an unknown user", async () => {
        targetUser = null;
        const state = await mediaMemberAction(IDLE, saveForm());

        expect(state).toEqual({ status: "error", error: "not_found" });
        expect(writes).toHaveLength(0);
    });

    it("rejects a user id that isn't a uuid", async () => {
        const state = await mediaMemberAction(IDLE, saveForm({ userId: "1 or 1=1" }));

        expect(state).toEqual({ status: "error", error: "not_found" });
        expect(createAdminClientMock).not.toHaveBeenCalled();
    });

    it("revokes only an active membership and keeps the row", async () => {
        const state = await mediaMemberAction(IDLE, form({ intent: "revoke", userId: USER_ID }));

        expect(state).toEqual({ status: "revoked" });
        expect(writes).toHaveLength(1);
        expect(writes[0].op).toBe("update");
        expect(Object.keys(writes[0].payload)).toEqual(["revoked_at"]);
        expect(writes[0].filters).toEqual([`user_id=${USER_ID}`, "revoked_at is null"]);
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("rejects an unknown intent", async () => {
        const state = await mediaMemberAction(IDLE, saveForm({ intent: "delete" }));

        expect(state).toEqual({ status: "error", error: "failed" });
        expect(createAdminClientMock).not.toHaveBeenCalled();
    });
});
