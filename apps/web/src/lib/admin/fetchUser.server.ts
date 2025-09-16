import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { Profile } from "@/types/database";
import type { ProfileWithAuth } from "@/types/users";
import { deriveEffectiveRole, type RoleKey } from "@/lib/auth/role";
import type { User } from "@supabase/supabase-js";

export async function getUserAdmin(userId: string): Promise<ProfileWithAuth | null> {
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) throw new Error(error.message);

    const u = data.user as User | null;
    if (!u) return null;

    const { data: p, error: pErr } = await admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const appMeta = (u.app_metadata ?? {}) as { role?: string; roles?: string[] };
    const rolesArr = Array.isArray(appMeta.roles) ? appMeta.roles : [];
    const effectiveRole: RoleKey = deriveEffectiveRole(rolesArr, appMeta.role ?? null);

    const createdAt = p?.created_at ?? u.created_at ?? new Date(0).toISOString();
    const updatedAt =
        p?.updated_at ?? u.last_sign_in_at ?? u.updated_at ?? createdAt;

    const profile: Profile = {
        id: u.id,
        username: p?.username ?? null,
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        age: null,
        gender: null,
        created_at: createdAt,
        updated_at: updatedAt,
    };

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
    };
}
