import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { MediaMember } from "@/lib/media/member";

type MediaMemberRow = {
    user_id: string;
    library_account: string | null;
    weekly_quota: number;
    granted_at: string;
    revoked_at: string | null;
};

const COLUMNS = "user_id, library_account, weekly_quota, granted_at, revoked_at";

function toMember(row: MediaMemberRow): MediaMember {
    return {
        userId: row.user_id,
        libraryAccount: row.library_account,
        weeklyQuota: row.weekly_quota,
        grantedAt: row.granted_at,
        revokedAt: row.revoked_at,
    };
}

export async function getMediaMember(userId: string): Promise<MediaMember | null> {
    const { data, error } = await createAdminClient()
        .from("media_member")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toMember(data as MediaMemberRow) : null;
}

/** Membership rows for the given users, keyed by user id. Users without a row are absent. */
export async function getMediaMembers(userIds: string[]): Promise<Record<string, MediaMember>> {
    if (userIds.length === 0) return {};
    const { data, error } = await createAdminClient()
        .from("media_member")
        .select(COLUMNS)
        .in("user_id", userIds);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MediaMemberRow[];
    return Object.fromEntries(rows.map((row) => [row.user_id, toMember(row)]));
}
