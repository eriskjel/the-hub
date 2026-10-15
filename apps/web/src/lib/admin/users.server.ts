import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import type { Profile } from "@/types/database";
import type { ProfileWithAuth } from "@/types/users";
import { deriveEffectiveRole, RoleKey } from "@/lib/auth/role";

import { parseUsersQuery, type AdminUsersQuery, type AdminUsersResult } from "./users";
import { getMediaMembers } from "./mediaMember.server";
import { isActiveMember } from "@/lib/media/member";
import { pickDisplayName } from "@/lib/auth/pickDisplayName";

/** One page of the user directory, reduced to the fields the list shows. */
export async function listUsersAdmin(input: Partial<AdminUsersQuery>): Promise<AdminUsersResult> {
    const { user: viewer } = await requireAdmin();
    const query = parseUsersQuery({
        page: String(input.page ?? 1),
        per: String(input.perPage ?? 10),
        q: input.q,
    });
    const result = await listUsers(query);
    const members = await getMediaMembers(result.users.map((user) => user.id));
    return {
        ...query,
        page: result.page,
        total: result.total,
        viewerId: viewer.id,
        users: result.users.map((user) => {
            const member = members[user.id];
            const active = isActiveMember(member);
            return {
                id: user.id,
                name: pickDisplayName(user),
                email: user.auth.email,
                role: user.auth.effective_role,
                lastSignIn: user.auth.last_sign_in_at,
                hasAccess: active || user.auth.effective_role === "admin",
                libraryAccount: active ? member.libraryAccount : null,
            };
        }),
    };
}

/** Global search is filtered before pagination; blank searches keep the paginated API path. */
async function listUsers({ page, perPage, q }: AdminUsersQuery) {
    const admin = createAdminClient();
    const query = q.trim().toLowerCase().slice(0, 100);

    if (!query) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(error.message);
        const total = data.total ?? data.users.length;
        // A bookmark past the end (e.g. after deletions) gets the last page instead of an empty one.
        const lastPage = Math.max(1, Math.ceil(total / perPage));
        if (page > lastPage) return listUsers({ page: lastPage, perPage, q });
        return { page, perPage, total, users: await enrichUsers(admin, data.users) };
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
