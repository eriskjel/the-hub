import { beforeEach, expect, it, vi } from "vitest";
const { requireAdmin, rpc, createAdmin } = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    rpc: vi.fn(),
    createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireAdmin.server", () => ({ requireAdmin }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdmin }));
import { listUsersAdmin } from "../users.server";
import { parseUsersQuery } from "../users";

beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ user: { id: "admin" } });
    createAdmin.mockReturnValue({ rpc });
    rpc.mockResolvedValue({ data: { page: 1, total: 0, users: [] }, error: null });
});
it("requires admin access before creating a privileged client", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("denied"));
    await expect(listUsersAdmin({ q: "alice" })).rejects.toThrow("denied");
    expect(createAdmin).not.toHaveBeenCalled();
});
it("requests a globally filtered page in one database call", async () => {
    await listUsersAdmin({ q: " Alice ", page: 3, perPage: 20 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_users_page", {
        p_query: "Alice",
        p_page: 3,
        p_per_page: 20,
    });
});
it("returns only list fields, including effective role and access", async () => {
    rpc.mockResolvedValue({
        data: {
            page: 1,
            total: 1,
            users: [
                {
                    id: "a",
                    email: "a@example.test",
                    full_name: null,
                    username: null,
                    user_metadata: { preferred_username: " Alice ", private: "secret" },
                    app_metadata: { roles: ["admin"] },
                    has_access: false,
                    library_account: "old-account",
                    last_sign_in_at: null,
                },
            ],
        },
        error: null,
    });
    const result = await listUsersAdmin({});
    expect(result.users).toEqual([
        {
            id: "a",
            name: "Alice",
            email: "a@example.test",
            role: "admin",
            hasAccess: true,
            libraryAccount: null,
            lastSignIn: null,
        },
    ]);
    expect(result.viewerId).toBe("admin");
});
it("propagates database failures instead of claiming an empty directory", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(listUsersAdmin({})).rejects.toThrow("unavailable");
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
