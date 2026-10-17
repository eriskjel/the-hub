import { z } from "zod";

/** Mirrors mr_status_check in the database. */
export const REQUEST_STATUSES = [
    "wanted",
    "searching",
    "proposed",
    "approved",
    "downloading",
    "available",
    "failed",
    "declined",
    "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Still being worked on: a new ask for the same title becomes a "+1". */
export const OPEN_STATUSES: readonly RequestStatus[] = [
    "wanted",
    "searching",
    "proposed",
    "approved",
    "downloading",
];

/** The requester can cancel only while nothing has been added. */
export const CANCELLABLE_STATUSES: readonly RequestStatus[] = ["wanted", "proposed"];

export const isOpenStatus = (s: RequestStatus) => OPEN_STATUSES.includes(s);
export const isCancellable = (s: RequestStatus) => CANCELLABLE_STATUSES.includes(s);

/** Quota: requests a member created in the last 7 days, not counting cancelled ones. */
export const QUOTA_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** A TMDB id: the only title data a request carries. Fits Postgres `int`. */
export const tmdbIdSchema = z.number().int().positive().max(2_147_483_647);
export const requestIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Mirrors mrn_note_length in the database. A blank note is no note. */
export const NOTE_MAX_LENGTH = 500;

/** What a member can add when requesting a title. */
export const requestExtrasSchema = z.object({
    note: z
        .string()
        .trim()
        .max(NOTE_MAX_LENGTH)
        .transform((note) => note || undefined)
        .optional(),
});
export type RequestExtras = z.input<typeof requestExtrasSchema>;

/** How the signed-in member relates to a request. */
export type RequestRole = "requester" | "follower" | null;

export type SearchResult = {
    tmdbId: number;
    title: string;
    year: string | null;
    posterPath: string | null;
    /** The queue entry for this title, if there is one (cancelled ones count as none). */
    request: { id: number; status: RequestStatus; role: RequestRole } | null;
};

export type RequestOutcome =
    | "requested"
    | "reopened"
    | "followed"
    | "unfollowed"
    | "cancelled"
    | "handed_over"
    | "already_requested"
    | "already_following"
    | "available"
    | "closed";

export type RequestError =
    | "not_member"
    | "not_found"
    | "quota_exceeded"
    | "not_cancellable"
    | "changed"
    | "failed";

export type RequestActionResult =
    | { ok: true; outcome: RequestOutcome }
    | { ok: false; error: RequestError };

/** TMDB image sizes we use (https://developer.themoviedb.org/docs/image-basics). */
export function posterUrl(path: string | null, size: "w92" | "w185" = "w185"): string | null {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
