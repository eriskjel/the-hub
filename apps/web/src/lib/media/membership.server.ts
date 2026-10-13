import "server-only";

import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAdminFromUser } from "@/lib/auth/isAdmin";
import { QUOTA_WINDOW_MS } from "@/lib/media/request";

export type OwnMembership = {
    active: boolean;
    /** Requests per week; null means no limit (admins). */
    weeklyQuota: number | null;
    revokedAt: string | null;
    /** Access comes from the admin role rather than a granted membership row. */
    viaAdmin: boolean;
};

const ADMIN_ACCESS: OwnMembership = {
    active: true,
    weeklyQuota: null,
    revokedAt: null,
    viaAdmin: true,
};

/**
 * The user's access to requests. Admins always have it, without a quota.
 * Everyone else needs an active media_member row, granted by an admin. `user`
 * must come from `auth.getUser()`, which reads app_metadata from the server.
 */
export async function getOwnMembership(user: User): Promise<OwnMembership | null> {
    if (isAdminFromUser(user)) return ADMIN_ACCESS;
    return readOwnMembership(user.id);
}

/**
 * The user's own media_member row, read with their session (RLS lets users
 * read only their own row), or null if they never had access. Cached per
 * render, so the header and the page share one query.
 */
const readOwnMembership = cache(async (userId: string): Promise<OwnMembership | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("media_member")
        .select("weekly_quota, revoked_at")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw new Error(`media membership lookup failed: ${error.message}`);
    if (!data) return null;
    return {
        active: data.revoked_at === null,
        weeklyQuota: data.weekly_quota,
        revokedAt: data.revoked_at,
        viaAdmin: false,
    };
});

/**
 * The client to read the queue with. Members use their own session, so RLS
 * applies. Admins may have no membership row, which RLS checks for, so they
 * read with the service role, as the admin pages do.
 */
export function queueReader(membership: OwnMembership, session: SupabaseClient): SupabaseClient {
    return membership.viaAdmin ? createAdminClient() : session;
}

/** Requests the user created within the quota window, not counting cancelled ones. */
export async function countRecentRequests(client: SupabaseClient, userId: string): Promise<number> {
    const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString();
    const { count, error } = await client
        .from("media_request")
        .select("id", { count: "exact", head: true })
        .eq("requested_by", userId)
        .neq("status", "cancelled")
        .gte("created_at", since);
    if (error) throw new Error(`media request count failed: ${error.message}`);
    return count ?? 0;
}
