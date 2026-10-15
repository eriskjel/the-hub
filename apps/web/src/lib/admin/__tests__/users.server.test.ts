import { beforeEach, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "@/tests/fakeSupabase";
import type { User } from "@supabase/supabase-js";

const { requireAdmin, listUsers, createAdmin } = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    listUsers: vi.fn(),
    createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireAdmin.server", () => ({ requireAdmin }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdmin }));
import { listUsersAdmin } from "../users.server";
import { parseUsersQuery } from "../users";

let db: FakeDb;
let users: User[];
const user = (i: number, overrides = {}) =>
    ({
        id: String(i),
        aud: "authenticated",
        email: `member${i}@example.test`,
        role: "authenticated",
        app_metadata: { roles: ["user"] },
        user_metadata: {},
        created_at: "2026-01-01",
        ...overrides,
    }) as User;

beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ user: { id: "admin" } });
    users = Array.from({ length: 105 }, (_, i) => user(i));
    db = fakeDb({ profiles: [], media_member: [] });
    createAdmin.mockImplementation(() => ({ auth: { admin: { listUsers } }, from: db.from }));
    listUsers.mockImplementation(async ({ page, perPage }) => ({
        data: { users: users.slice((page - 1) * perPage, page * perPage), total: users.length },
        error: null,
    }));
});

it("finds a user beyond the first API page and reports the matching total", async () => {
    const result = await listUsersAdmin({ q: "MEMBER104", perPage: 5 });
    expect(result.total).toBe(1);
    expect(result.users.map((u) => u.id)).toEqual(["104"]);
    expect(listUsers).toHaveBeenCalledTimes(2);
});

it("filters before paginating matches", async () => {
    const result = await listUsersAdmin({ q: "member", page: 2, perPage: 5 });
    expect(result.total).toBe(105);
    expect(result.users.map((u) => u.id)).toEqual(["5", "6", "7", "8", "9"]);
});

it("matches profile names, usernames and provider display names", async () => {
    db.tables.profiles = [
        { id: "101", username: "MatchedName", full_name: null },
        { id: "102", username: null, full_name: "Matched Name" },
    ];
    users[103].user_metadata = { preferred_username: "MatchedProvider" };
    users[104].user_metadata = { user_name: "MatchedAlias" };
    const result = await listUsersAdmin({ q: " matched " });
    expect(result.users.map((u) => u.id)).toEqual(["101", "102", "103", "104"]);
});

it("uses the direct pagination path without a search", async () => {
    const result = await listUsersAdmin({ q: "  ", page: 2, perPage: 5 });
    expect(result.total).toBe(105);
    expect(result.users.map((u) => u.id)).toEqual(["5", "6", "7", "8", "9"]);
    expect(listUsers).toHaveBeenCalledExactlyOnceWith({ page: 2, perPage: 5 });
});

it("moves a page past the end of an unfiltered list to its last page", async () => {
    const result = await listUsersAdmin({ page: 99, perPage: 50 });
    expect(result.page).toBe(3);
    expect(result.users.map((u) => u.id)).toEqual(["100", "101", "102", "103", "104"]);
    expect(listUsers).toHaveBeenLastCalledWith({ page: 3, perPage: 50 });
});

it("returns only list fields, with access from an active membership or the admin role", async () => {
    users = [
        user(0, { app_metadata: { roles: ["admin"] }, last_sign_in_at: "2026-02-01T10:00:00Z" }),
        user(1, { user_metadata: { preferred_username: " Alice ", private: "secret" } }),
        user(2),
    ];
    const member = { weekly_quota: 3, granted_at: "2026-01-02" };
    db.tables.media_member = [
        { ...member, user_id: "1", library_account: "alice-account", revoked_at: null },
        { ...member, user_id: "2", library_account: "old-account", revoked_at: "2026-01-03" },
    ];
    const result = await listUsersAdmin({});
    expect(result.viewerId).toBe("admin");
    expect(result.users).toEqual([
        {
            id: "0",
            name: "member0",
            email: "member0@example.test",
            role: "admin",
            hasAccess: true,
            libraryAccount: null,
            lastSignIn: "2026-02-01T10:00:00Z",
        },
        {
            id: "1",
            name: "Alice",
            email: "member1@example.test",
            role: "user",
            hasAccess: true,
            libraryAccount: "alice-account",
            lastSignIn: null,
        },
        {
            id: "2",
            name: "member2",
            email: "member2@example.test",
            role: "user",
            hasAccess: false,
            libraryAccount: null,
            lastSignIn: null,
        },
    ]);
});

it("finishes when the last API page is full", async () => {
    users = users.slice(0, 100);
    expect((await listUsersAdmin({ q: "member" })).total).toBe(100);
    expect(listUsers).toHaveBeenCalledTimes(2);
});

it("clamps a searched page to the matching pages and returns empty results on page one", async () => {
    expect((await listUsersAdmin({ q: "member104", page: 99 })).page).toBe(1);
    expect(await listUsersAdmin({ q: "missing", page: 99 })).toMatchObject({
        page: 1,
        total: 0,
        users: [],
    });
});

it("requires an admin before creating the privileged client", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("denied"));
    await expect(listUsersAdmin({ q: "member" })).rejects.toThrow("denied");
    expect(createAdmin).not.toHaveBeenCalled();
});

it("reports a later API failure instead of returning a partial search", async () => {
    listUsers
        .mockImplementationOnce(async () => ({ data: { users: users.slice(0, 100) }, error: null }))
        .mockImplementationOnce(async () => ({ data: null, error: { message: "unavailable" } }));
    await expect(listUsersAdmin({ q: "member" })).rejects.toThrow("unavailable");
});

it("reports a profile lookup failure instead of missing name matches", async () => {
    db.failNext("profiles", "select");
    await expect(listUsersAdmin({ q: "name" })).rejects.toThrow("select on profiles failed");
});

it("normalizes repeated and invalid URL parameters", () => {
    expect(parseUsersQuery({ q: [" alice ", "bob"], page: ["2", "3"], per: "20" })).toEqual({
        q: "alice",
        page: 2,
        perPage: 20,
    });
    expect(parseUsersQuery({ page: "Infinity", per: "999", q: "x".repeat(110) })).toEqual({
        page: 1,
        perPage: 10,
        q: "x".repeat(100),
    });
});
