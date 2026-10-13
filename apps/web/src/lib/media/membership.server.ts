import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { QUOTA_WINDOW_MS } from "@/lib/media/request";

export type OwnMembership = {
    active: boolean;
    weeklyQuota: number;
    revokedAt: string | null;
};

/**
 * The user's own media_member row, read with their session (RLS lets users
 * read only their own row), or null if they never had access. Cached per
 * render, so the header and the page share one query.
 */
export const getOwnMembership = cache(async (userId: string): Promise<OwnMembership | null> => {
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
    };
});

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
