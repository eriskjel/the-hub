import type { Profile } from "@/types/database";
import type { ProfileWithAuth } from "@/types/users";

type UserLike = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

// Overloads
export function pickDisplayName(u: ProfileWithAuth): string;
export function pickDisplayName(profile: Profile | null, user: UserLike | null): string;

export function pickDisplayName(
    arg1: ProfileWithAuth | Profile | null,
    arg2?: UserLike | null
): string {
    // (profile, user) form
    if (arg2 !== undefined) {
        const profile = arg1 as Profile | null;
        const user = arg2;

        const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
        const get = (k: string) => {
            const v = md[k];
            return typeof v === "string" ? v.trim() : "";
        };

        const candidates = [
            profile?.full_name?.trim() ?? "",
            profile?.username?.trim() ?? "",
            get("full_name"),
            get("name"),
            get("user_name"),
            get("preferred_username"),
            (user?.email ?? "").split("@")[0],
        ];

        return candidates.find((s) => s && s.length > 0) ?? "—";
    }

    // (ProfileWithAuth) form
    const u = arg1 as ProfileWithAuth;
    const m = (u.auth.raw_user_meta_data ?? {}) as Record<string, unknown>;
    const get = (k: string) => (typeof m[k] === "string" ? (m[k] as string).trim() : "");

    const candidates = [
        u.full_name?.trim() ?? "",
        u.username?.trim() ?? "",
        get("full_name"),
        get("name"),
        get("user_name"),
        get("preferred_username"),
        (u.auth.email ?? "").split("@")[0],
    ];

    return candidates.find((s) => s && s.length > 0) ?? "—";
}
