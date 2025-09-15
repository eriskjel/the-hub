import type { Profile } from "@/types/database";
import type { AdminAuthUser } from "@/types/auth";
import type { RoleKey } from "@/lib/auth/role";

export type ProfileWithAuth = Profile & { auth: AdminAuthUser & { effective_role: RoleKey } };

export type AdminUserRow = {
    id: string;
    name: string | null;
    email: string;
    roleKey: RoleKey;
    rolesJoined: string;
    lastSignIn: string | null;
    avatarUrl: string | null;
};

export function toAdminUserRow(u: ProfileWithAuth): AdminUserRow {
    return {
        id: u.id,
        name: u.full_name ?? u.username,
        email: u.auth.email,
        roleKey: u.auth.effective_role,
        rolesJoined: (u.auth.roles ?? u.auth.raw_app_meta_data.roles ?? []).join(", "),
        lastSignIn: u.auth.last_sign_in_at,
        avatarUrl: u.avatar_url,
    };
}
