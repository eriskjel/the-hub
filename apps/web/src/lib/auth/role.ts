export type RoleKey = "admin" | "user" | "unknown";

/** Collapse metadata into a single effective role key with priority. */
export function deriveEffectiveRole(roles?: string[] | null, single?: string | null): RoleKey {
    const set = new Set((roles ?? []).map((r) => r.toLowerCase()));
    const s = (single ?? "").toLowerCase();
    if (set.has("admin") || s === "admin") return "admin";
    if (set.has("user") || s === "user") return "user";
    return "unknown";
}

/** Map the role key to a translation key segment (kept same for simplicity). */
export function roleKeyToI18n(role: RoleKey): RoleKey {
    return role;
}
