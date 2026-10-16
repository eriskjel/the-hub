import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { supabase } from "@/tests/testUtils";
const { listUsersAdmin } = vi.hoisted(() => ({ listUsersAdmin: vi.fn() }));
vi.mock("@/lib/admin/users.server", () => ({ listUsersAdmin }));
import { GET } from "../route";
const request = () => new NextRequest("http://localhost/api/admin/users?page=2&per=20&q=Alice");
beforeEach(() => {
    vi.clearAllMocks();
    supabase().setAuthHandlers({
        getUser: async () => ({
            data: { user: { id: "admin", app_metadata: { roles: ["admin"] } } },
        }),
    });
});
it("rejects anonymous and non-admin readers before querying", async () => {
    supabase().setAuthHandlers({ getUser: async () => ({ data: { user: null } }) });
    expect((await GET(request())).status).toBe(401);
    supabase().setAuthHandlers({
        getUser: async () => ({
            data: { user: { id: "member", app_metadata: { roles: ["user"] } } },
        }),
    });
    expect((await GET(request())).status).toBe(403);
    expect(listUsersAdmin).not.toHaveBeenCalled();
});
it("serves the requested page with private no-store caching", async () => {
    listUsersAdmin.mockResolvedValue({ users: [], total: 0, page: 1 });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(listUsersAdmin).toHaveBeenCalledWith({ page: 2, perPage: 20, q: "Alice" });
});
it("does not leak database error details", async () => {
    listUsersAdmin.mockRejectedValue(new Error("private database details"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unavailable" });
});
