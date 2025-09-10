import type { User } from "@supabase/supabase-js";

export function isAdminFromUser(user: User | null | undefined): boolean {
    const am = (user?.app_metadata ?? {}) as Record<string, unknown>;
    const roles = (am.roles as string[] | undefined) ?? [];
    const role = (am.role as string | undefined) ?? "";

    const norm = (s: string) => s.toLowerCase();
    return roles.map(norm).includes("admin") || norm(role) === "admin";
}
