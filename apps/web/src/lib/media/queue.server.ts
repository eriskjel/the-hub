import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { getMovie } from "@/lib/media/tmdb.server";
import { OPEN_STATUSES, type RequestRole, type RequestStatus } from "@/lib/media/request";
import { NEEDS_ADMIN_STATUSES } from "@/lib/media/admin";
import type { RequestDetail } from "./detail";

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
    detail: RequestDetail | null;
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
    detail_code: string | null;
    detail_args: unknown;
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
                    "id, tmdb_id, status, status_detail, detail_code, detail_args, requested_by, created_at, updated_at, media_request_follower(user_id)"
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
            detail: r.detail_code ? { code: r.detail_code, args: r.detail_args } : null,
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

/** A release the worker proposed. Rank 1 is its pick. */
export type RequestOption = { rank: number; label: string; reason: string | null };

/**
 * The proposed releases per request, best first. Members have no access to
 * them, so read with the service role.
 */
export async function getRequestOptions(
    client: SupabaseClient,
    requestIds: number[]
): Promise<Map<number, RequestOption[]>> {
    const options = new Map<number, RequestOption[]>();
    if (requestIds.length === 0) return options;
    const { data, error } = await client
        .from("media_request_option")
        .select("request_id, rank, label, reason")
        .in("request_id", requestIds)
        .order("rank");
    if (error) throw new Error(`media options read failed: ${error.message}`);
    for (const { request_id, ...option } of (data ?? []) as (RequestOption & {
        request_id: number;
    })[]) {
        options.set(request_id, [...(options.get(request_id) ?? []), option]);
    }
    return options;
}

/**
 * Requests waiting for an admin, counted apart from the queue lists, whose
 * limits can leave some out. Zero if the count fails: it only adds a pointer.
 */
export async function countWaitingForAdmin(client: SupabaseClient): Promise<number> {
    const { count, error } = await client
        .from("media_request")
        .select("id", { count: "exact", head: true })
        .eq("media_type", "movie")
        .in("status", NEEDS_ADMIN_STATUSES);
    if (error) {
        console.error("media queue: waiting count failed:", error.message);
        return 0;
    }
    return count ?? 0;
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
