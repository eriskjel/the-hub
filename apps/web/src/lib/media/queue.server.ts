import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { getMovie } from "@/lib/media/tmdb.server";
import { OPEN_STATUSES, type RequestRole, type RequestStatus } from "@/lib/media/request";

/** Separate limits for the oldest open work and the newest history. */
const QUEUE_LIMIT = 200;

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
 * The shared queue (movies, cancelled ones left out), read with the member's
 * session so RLS applies. Titles and posters come from TMDB through the data
 * cache; nothing about a title is stored but its id.
 */
export async function getQueue(
    supabase: SupabaseClient,
    userId: string,
    locale: Locale,
    options: { includeCancelled?: boolean } = {}
): Promise<QueueItem[]> {
    const read = () =>
        supabase
            .from("media_request")
            .select(
                "id, tmdb_id, status, status_detail, requested_by, created_at, updated_at, media_request_follower(user_id)"
            )
            .eq("media_type", "movie");
    const [open, history] = await Promise.all([
        read()
            .in("status", OPEN_STATUSES)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .limit(QUEUE_LIMIT),
        read()
            .in(
                "status",
                options.includeCancelled
                    ? ["available", "failed", "declined", "cancelled"]
                    : ["available", "failed", "declined"]
            )
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(QUEUE_LIMIT),
    ]);
    const error = open.error ?? history.error;
    if (error) throw new Error(`media queue read failed: ${error.message}`);
    const rows = [...(open.data ?? []), ...(history.data ?? [])] as Row[];

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
