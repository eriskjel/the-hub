import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { getMovie } from "@/lib/media/tmdb.server";
import { OPEN_STATUSES, type RequestRole, type RequestStatus } from "@/lib/media/request";

/** Each section of the queue has its own limit. */
const QUEUE_LIMIT = 200;

type Section = {
    statuses: readonly RequestStatus[];
    orderBy: "created_at" | "updated_at";
    ascending: boolean;
};

/** Open work in the order it's worked, then the newest history. */
const MEMBER_SECTIONS: Section[] = [
    { statuses: OPEN_STATUSES, orderBy: "created_at", ascending: true },
    { statuses: ["available", "failed", "declined"], orderBy: "created_at", ascending: false },
];

/**
 * Admins also see cancelled requests. Closed requests are listed by their last
 * change, apart from available titles, so one that just failed comes first.
 */
const ADMIN_SECTIONS: Section[] = [
    { statuses: OPEN_STATUSES, orderBy: "created_at", ascending: true },
    { statuses: ["failed", "declined", "cancelled"], orderBy: "updated_at", ascending: false },
    { statuses: ["available"], orderBy: "updated_at", ascending: false },
];

export type QueueItem = {
    id: number;
    tmdbId: number;
    /** Null if TMDB couldn't be reached; the page shows the id instead. */
    title: string | null;
    year: string | null;
    posterPath: string | null;
    status: RequestStatus;
    statusDetail: string | null;
    /** Null when the requester's account was deleted. */
    requester: { name: string | null; isYou: boolean } | null;
    followerCount: number;
    role: RequestRole;
    createdAt: string;
    updatedAt: string;
};

type Row = {
    id: number;
    tmdb_id: number;
    status: RequestStatus;
    status_detail: string | null;
    requested_by: string | null;
    created_at: string;
    updated_at: string;
    media_request_follower: { user_id: string }[];
};

/**
 * The shared queue (movies, cancelled ones left out for members), read with the
 * member's session so RLS applies. Titles and posters come from TMDB through
 * the data cache; nothing about a title is stored but its id.
 */
export async function getQueue(
    supabase: SupabaseClient,
    userId: string,
    locale: Locale,
    options: { admin?: boolean } = {}
): Promise<QueueItem[]> {
    const results = await Promise.all(
        (options.admin ? ADMIN_SECTIONS : MEMBER_SECTIONS).map(({ statuses, orderBy, ascending }) =>
            supabase
                .from("media_request")
                .select(
                    "id, tmdb_id, status, status_detail, requested_by, created_at, updated_at, media_request_follower(user_id)"
                )
                .eq("media_type", "movie")
                .in("status", statuses)
                .order(orderBy, { ascending })
                .order("id", { ascending })
                .limit(QUEUE_LIMIT)
        )
    );
    const error = results.find((r) => r.error)?.error;
    if (error) throw new Error(`media queue read failed: ${error.message}`);
    const rows = results.flatMap((r) => r.data ?? []) as Row[];

    const names = await getNames(
        supabase,
        rows.flatMap((r) => (r.requested_by ? [r.requested_by] : []))
    );
    const movies = await Promise.all(
        rows.map((r) =>
            getMovie(r.tmdb_id, locale).catch((e: Error) => {
                console.error("media queue: TMDB lookup failed:", e.message);
                return null;
            })
        )
    );

    return rows.map((r, i) => {
        const following = r.media_request_follower.some((f) => f.user_id === userId);
        return {
            id: r.id,
            tmdbId: r.tmdb_id,
            title: movies[i]?.title ?? null,
            year: movies[i]?.year ?? null,
            posterPath: movies[i]?.posterPath ?? null,
            status: r.status,
            statusDetail: r.status_detail,
            requester: r.requested_by
                ? { name: names.get(r.requested_by) ?? null, isYou: r.requested_by === userId }
                : null,
            followerCount: r.media_request_follower.length,
            role: r.requested_by === userId ? "requester" : following ? "follower" : null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    });
}

async function getNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", unique);
    if (error) {
        // Names are a nicety; the queue still renders without them.
        console.error("media queue: profile read failed:", error.message);
        return new Map();
    }
    return new Map(
        (data ?? []).flatMap((p) => {
            const name = p.full_name || p.username;
            return name ? [[p.id as string, name as string]] : [];
        })
    );
}
