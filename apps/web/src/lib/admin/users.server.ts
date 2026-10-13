import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import type { Profile } from "@/types/database";
import type { ProfileWithAuth } from "@/types/users";
import { deriveEffectiveRole, RoleKey } from "@/lib/auth/role";

export type AdminUsersQuery = { page?: number; perPage?: number; q?: string };

/** Global search is filtered before pagination; blank searches keep the paginated API path. */
export async function listUsersAdmin({ page = 1, perPage = 20, q = "" }: AdminUsersQuery) {
    await requireAdmin();
    const admin = createAdminClient();
    page = Number.isSafeInteger(page) && page > 0 ? page : 1;
    perPage = Number.isSafeInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : 20;
    const query = q.trim().toLowerCase().slice(0, 100);

    if (!query) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(error.message);
        return {
            page,
            perPage,
            total: data.total ?? data.users.length,
            users: await enrichUsers(admin, data.users),
        };
    }

    const matches: ProfileWithAuth[] = [];
    const batchSize = 100;
    for (let batchPage = 1; ; batchPage++) {
        const { data, error } = await admin.auth.admin.listUsers({
            page: batchPage,
            perPage: batchSize,
        });
        if (error) throw new Error(error.message);
        const users = await enrichUsers(admin, data.users);
        matches.push(
            ...users.filter((u) =>
                [
                    u.auth.email,
                    u.username,
                    u.full_name,
                    u.auth.raw_user_meta_data.preferred_username,
                    u.auth.raw_user_meta_data.user_name,
                    u.auth.raw_user_meta_data.full_name,
                    u.auth.raw_user_meta_data.name,
                ].some((value) => typeof value === "string" && value.toLowerCase().includes(query))
            )
        );
        if (data.users.length < batchSize) break;
    }
    const total = matches.length;
    page = Math.min(page, Math.max(1, Math.ceil(total / perPage)));
    return { page, perPage, total, users: matches.slice((page - 1) * perPage, page * perPage) };
}

async function enrichUsers(admin: SupabaseClient, authUsers: User[]): Promise<ProfileWithAuth[]> {
    const ids = authUsers.map((u) => u.id);

    let rawProfiles:
        | Array<
              Pick<
                  Profile,
                  "id" | "username" | "full_name" | "avatar_url" | "created_at" | "updated_at"
              >
          >
        | [] = [];

    if (ids.length > 0) {
        const { data: pData, error: pErr } = await admin
            .from("profiles")
            .select("id, username, full_name, avatar_url, created_at, updated_at")
            .in("id", ids);
        if (pErr) throw new Error(pErr.message);
        rawProfiles = (pData ?? []) as typeof rawProfiles;
    }

    const byId = new Map(rawProfiles.map((p) => [p.id, p]));

    const users: ProfileWithAuth[] = authUsers.map((u) => {
        const p = byId.get(u.id);

        const fallbackCreated =
            (u as unknown as { created_at?: string })?.created_at ?? new Date(0).toISOString();
        const fallbackUpdated =
            u.last_sign_in_at ??
            (u as unknown as { updated_at?: string })?.updated_at ??
            fallbackCreated;

        const profile: Profile = {
            id: u.id,
            username: p?.username ?? null,
            full_name: p?.full_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            age: null,
            gender: null,
            created_at: p?.created_at ?? fallbackCreated,
            updated_at: p?.updated_at ?? fallbackUpdated,
        };

        const appMeta = (u.app_metadata ?? {}) as {
            role?: string;
            roles?: string[];
            provider?: string;
            providers?: string[];
        };

        const rolesArr = Array.isArray(appMeta.roles) ? appMeta.roles : [];

        const effectiveRole: RoleKey = deriveEffectiveRole(rolesArr, appMeta.role ?? null);

        return {
            ...profile,
            auth: {
                id: u.id,
                email: u.email ?? "",
                role: u.role ?? "authenticated",
                roles: rolesArr,
                effective_role: effectiveRole,
                last_sign_in_at: u.last_sign_in_at ?? null,
                raw_app_meta_data: appMeta,
                raw_user_meta_data: (u.user_metadata ?? {}) as Record<string, unknown>,
            },
        } satisfies ProfileWithAuth;
    });

    return users;
}
