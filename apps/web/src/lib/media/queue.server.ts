import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMovie } from "@/lib/media/tmdb.server";
import { OPEN_STATUSES, type RequestRole, type RequestStatus } from "@/lib/media/request";
import { NEEDS_ADMIN_STATUSES } from "@/lib/media/admin";
import { calendarDate, DETAIL_CODES, type RequestDetail } from "./detail";
import type { Retention } from "./retention";

/** Each section of the queue has its own limit. */
const QUEUE_LIMIT = 200;
const LEGACY_COLUMNS =
    "id, tmdb_id, status, status_detail, requested_by, created_at, updated_at, media_request_follower(user_id)";
const DETAIL_COLUMNS =
    `${LEGACY_COLUMNS}, detail_code, detail_args, remove_after_days, remove_at` as const;
const RETENTION_COLUMNS =
    `${DETAIL_COLUMNS}, admin_retention, admin_remove_after_days, retention_changed_by, retention_deadline, removal_eligible` as const;

function missingDetailColumns(error: { code: string; message: string } | null): boolean {
    if (!error) return false;
    return (
        (error.code === "42703" &&
            /^column (?:public\.)?media_request\.(?:detail_code|detail_args|remove_after_days|remove_at) does not exist$/.test(
                error.message
            )) ||
        (error.code === "PGRST204" &&
            /^Could not find the '(?:detail_code|detail_args|remove_after_days|remove_at)' column of 'media_request' in the schema cache$/.test(
                error.message
            ))
    );
}

type Section = {
    statuses: readonly RequestStatus[];
    orderBy: "created_at" | "updated_at";
    ascending: boolean;
};

/** Open work oldest first (the page groups it by stage), then the newest history. */
const MEMBER_SECTIONS: Section[] = [
    { statuses: OPEN_STATUSES, orderBy: "created_at", ascending: true },
    {
        statuses: ["available", "failed", "declined", "removed"],
        orderBy: "created_at",
        ascending: false,
    },
];

/**
 * Admins also see cancelled requests. Closed requests are listed by their last
 * change, apart from available titles, so one that just failed comes first.
 */
const ADMIN_SECTIONS: Section[] = [
    { statuses: OPEN_STATUSES, orderBy: "created_at", ascending: true },
    {
        statuses: ["failed", "declined", "cancelled", "removed"],
        orderBy: "updated_at",
        ascending: false,
    },
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
    /** Admins get every note; everyone else only their own. */
    notes: QueueNote[];
    /**
     * A temporary title: removed `days` after it's added, unless someone +1s
     * it. `at` is set once the worker has scheduled it. Null when it stays.
     */
    removal: { days: number; at: string | null } | null;
    /** Missing until the retention migration is installed. */
    retention?: Retention;
    followerCount: number;
    role: RequestRole;
    createdAt: string;
    updatedAt: string;
};

export type QueueNote = { author: { name: string | null; isYou: boolean }; text: string };

type Row = {
    id: number;
    tmdb_id: number;
    status: RequestStatus;
    status_detail: string | null;
    detail_code: string | null;
    detail_args: unknown;
    remove_after_days?: number | null;
    remove_at?: string | null;
    admin_retention?: "keep" | "remove" | null;
    admin_remove_after_days?: number | null;
    retention_changed_by?: string | null;
    retention_deadline?: string | null;
    removal_eligible?: boolean | null;
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
    options: { admin?: boolean } = {}
): Promise<QueueItem[]> {
    const results = await Promise.all(
        (options.admin ? ADMIN_SECTIONS : MEMBER_SECTIONS).map(
            async ({ statuses, orderBy, ascending }) => {
                const query = (details: boolean, retention = false) => {
                    const table = supabase.from("media_request");
                    const selection = details
                        ? table.select(retention ? RETENTION_COLUMNS : DETAIL_COLUMNS)
                        : table.select(LEGACY_COLUMNS);
                    return selection
                        .eq("media_type", "movie")
                        .in("status", statuses)
                        .order(orderBy, { ascending })
                        .order("id", { ascending })
                        .limit(QUEUE_LIMIT);
                };
                let result = await query(true, true);
                if (
                    result.error &&
                    ["42703", "PGRST204"].includes(result.error.code) &&
                    /\b(admin_retention|admin_remove_after_days|retention_changed_by|retention_deadline|removal_eligible)\b/.test(
                        result.error.message
                    )
                ) {
                    result = await query(true);
                }
                // App and migration deployments can finish in either order. Retry only
                // the missing additive fields; permission and other errors still fail.
                return missingDetailColumns(result.error) ? await query(false) : result;
            }
        )
    );
    const error = results.find((r) => r.error)?.error;
    if (error) throw new Error(`media queue read failed: ${error.message}`);
    const rows = results.flatMap((r) => (r.data ?? []) as unknown as Row[]);
    const notes = await getNotes(
        supabase,
        rows.map((r) => r.id),
        options.admin ? null : userId
    );

    const names = await getNames(supabase, [
        ...rows.flatMap((r) => (r.requested_by ? [r.requested_by] : [])),
        ...notes.map((n) => n.user_id),
        ...rows.flatMap((r) => (r.retention_changed_by ? [r.retention_changed_by] : [])),
    ]);
    const movies = await Promise.all(
        rows.map((r) =>
            getMovie(r.tmdb_id).catch((e: Error) => {
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
            removal: r.remove_after_days
                ? { days: r.remove_after_days, at: r.retention_deadline ?? r.remove_at ?? null }
                : null,
            ...(r.admin_retention !== undefined && {
                retention: {
                    policy: r.admin_retention ?? "requester",
                    days: r.admin_remove_after_days ?? null,
                    by: r.retention_changed_by ? (names.get(r.retention_changed_by) ?? null) : null,
                    eligible: r.removal_eligible ?? null,
                },
            }),
            requester: r.requested_by
                ? { name: names.get(r.requested_by) ?? null, isYou: r.requested_by === userId }
                : null,
            notes: notes
                .filter((n) => n.request_id === r.id)
                .map((n) => ({
                    author: { name: names.get(n.user_id) ?? null, isYou: n.user_id === userId },
                    text: n.note,
                })),
            followerCount: r.media_request_follower.length,
            role: r.requested_by === userId ? "requester" : following ? "follower" : null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    });
}

const STAGES: readonly RequestStatus[] = [
    "downloading",
    "approved",
    "searching",
    "proposed",
    "wanted",
];

/**
 * Members' open queue, closest to done first: being added, waiting for the
 * admin, then in line. Films that aren't out yet come last, soonest first.
 * Within a stage the order is kept (oldest first).
 */
export function sortByStage(items: QueueItem[]): QueueItem[] {
    const releaseDate = (item: QueueItem) => {
        if (item.status !== "wanted" || item.detail?.code !== "waiting_release") return null;
        const args = DETAIL_CODES.waiting_release.args.safeParse(item.detail.args);
        return args.success && calendarDate(args.data.date) ? args.data.date : null;
    };
    const stage = (item: QueueItem) =>
        releaseDate(item) === null ? STAGES.indexOf(item.status) : STAGES.length;
    return [...items].sort(
        (a, b) => stage(a) - stage(b) || (releaseDate(a) ?? "").localeCompare(releaseDate(b) ?? "")
    );
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

type NoteRow = { request_id: number; user_id: string; note: string };

/**
 * Notes for the displayed requests, oldest first, with only the user's own
 * notes outside the admin view. Page below the API's 1,000-row response cap.
 */
async function getNotes(
    supabase: SupabaseClient,
    requestIds: number[],
    userId: string | null
): Promise<NoteRow[]> {
    if (requestIds.length === 0) return [];
    const pageSize = 500;
    const notes: NoteRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
        const query = supabase
            .from("media_request_note")
            .select("request_id, user_id, note")
            .in("request_id", requestIds)
            .order("created_at")
            .order("request_id")
            .order("user_id")
            .range(offset, offset + pageSize - 1);
        const { data, error } = await (userId ? query.eq("user_id", userId) : query);
        if (error) {
            console.error("media queue: note read failed:", error.message);
            return [];
        }
        const page = (data ?? []) as NoteRow[];
        notes.push(...page);
        if (page.length < pageSize) return notes;
    }
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
