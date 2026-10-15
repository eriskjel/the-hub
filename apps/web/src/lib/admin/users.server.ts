import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { deriveEffectiveRole } from "@/lib/auth/role";
import { parseUsersQuery, type AdminUsersQuery, type AdminUsersResult } from "./users";

type UserRecord = {
    id: string;
    email: string | null;
    full_name: string | null;
    username: string | null;
    user_metadata: Record<string, unknown> | null;
    app_metadata: { role?: string; roles?: string[] } | null;
    last_sign_in_at: string | null;
    has_access: boolean;
    library_account: string | null;
};

/** One database query filters before pagination, including auth and profile names. */
export async function listUsersAdmin(input: Partial<AdminUsersQuery>): Promise<AdminUsersResult> {
    const { user: viewer } = await requireAdmin();
    const query = parseUsersQuery({
        page: String(input.page ?? 1),
        per: String(input.perPage ?? 10),
        q: input.q,
    });
    const { data, error } = await createAdminClient().rpc("admin_users_page", {
        p_page: query.page,
        p_per_page: query.perPage,
        p_query: query.q,
    });
    if (error) throw new Error(error.message);
    const result = data as { users: UserRecord[]; total: number; page: number };
    return {
        ...query,
        page: result.page,
        viewerId: viewer.id,
        total: result.total,
        users: result.users.map((user) => {
            const meta = user.user_metadata ?? {};
            const role = deriveEffectiveRole(user.app_metadata?.roles, user.app_metadata?.role);
            const name = [
                user.full_name,
                user.username,
                meta.full_name,
                meta.name,
                meta.user_name,
                meta.preferred_username,
                user.email?.split("@")[0],
            ].find((value) => typeof value === "string" && value.trim()) as string | undefined;
            return {
                id: user.id,
                name: name?.trim() ?? "—",
                email: user.email ?? "",
                role,
                lastSignIn: user.last_sign_in_at,
                hasAccess: role === "admin" || user.has_access,
                libraryAccount: user.has_access ? user.library_account : null,
            };
        }),
    };
}
