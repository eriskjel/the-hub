import type { ProfileWithAuth } from "@/types/users";

export function pickDisplayName(u: ProfileWithAuth): string {
    const m = (u.auth.raw_user_meta_data ?? {}) as Record<string, unknown>;
    const get = (k: string) => {
        const v = m[k];
        return typeof v === "string" ? v.trim() : "";
    };

    const candidates = [
        u.full_name?.trim() ?? "", // from public.profiles
        u.username?.trim() ?? "", // from public.profiles
        get("full_name"),
        get("name"),
        get("user_name"),
        get("preferred_username"),
        (u.auth.email ?? "").split("@")[0],
    ];

    return candidates.find((s) => s && s.length > 0) ?? "—";
}
