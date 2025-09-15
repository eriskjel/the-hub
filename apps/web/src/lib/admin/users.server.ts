import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { Profile } from "@/types/database";
import type { ProfileWithAuth } from "@/types/users";
import { deriveEffectiveRole, RoleKey } from "@/lib/auth/role";

export type AdminUsersQuery = { page?: number; perPage?: number; q?: string };

export async function listUsersAdmin({ page = 1, perPage = 20, q = "" }: AdminUsersQuery) {
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    let authUsers = data.users;
    const qq = q.trim().toLowerCase();
    if (qq) {
        authUsers = authUsers.filter(
            (u) =>
                u.email?.toLowerCase().includes(qq) ||
                (u.user_metadata?.preferred_username as string | undefined)
                    ?.toLowerCase()
                    .includes(qq)
        );
    }

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

    return { page, perPage, total: data.total ?? users.length, users };
}
