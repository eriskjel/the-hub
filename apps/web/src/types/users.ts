import type { Profile } from "@/types/database";
import type { AuthUser } from "@/types/auth";

export type ProfileWithAuth = Profile & {
    auth: AuthUser;
};

export type AdminUserRow = {
    id: string;
    name: string | null;
    email: string;
    role: string;
    rolesJoined: string;
    lastSignIn: string | null;
    avatarUrl: string | null;
};

export function toAdminUserRow(u: ProfileWithAuth): AdminUserRow {
    return {
        id: u.id,
        name: u.full_name,
        email: u.auth.email,
        role: u.auth.raw_app_meta_data.role ?? u.auth.role ?? "user",
        rolesJoined: (u.auth.raw_app_meta_data.roles ?? []).join(", "),
        lastSignIn: u.auth.last_sign_in_at,
        avatarUrl: u.avatar_url,
    };
}
