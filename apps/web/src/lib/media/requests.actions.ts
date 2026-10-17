"use server";

import { refresh } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getOwnMembership } from "@/lib/media/membership.server";
import { getMovie } from "@/lib/media/tmdb.server";
import {
    REMOVE_AFTER_DAYS,
    requestExtrasSchema,
    requestIdSchema,
    tmdbIdSchema,
    type RequestExtras,
    type RequestActionResult,
    type RequestError,
    type RequestOutcome,
} from "@/lib/media/request";

/** `weeklyQuota` null: no limit (admins). */
type Member = { id: string; weeklyQuota: number | null };

/*
 * Members' write path for the shared request queue. Users have no write
 * policies on the media tables, so every change goes through here: the
 * session and an active membership are checked first, then the service role
 * writes. The client sends only ids; everything else comes from the database
 * or from TMDB. Writes that depend on a row's state are conditional on it.
 */

/**
 * Request a movie, or "+1" it if someone else already has. A note ("the
 * extended cut") is for the admin, and the worker leaves such a request to them.
 */
export async function requestMovie(
    tmdbId: number,
    extras: RequestExtras = {}
): Promise<RequestActionResult> {
    const member = await currentMember();
    if (!member) return fail("not_member");

    const id = tmdbIdSchema.safeParse(tmdbId);
    if (!id.success) return fail("not_found");
    const extra = requestExtrasSchema.safeParse(extras);
    if (!extra.success) return fail("failed");

    try {
        if (!(await getMovie(id.data))) return fail("not_found");
    } catch (e) {
        console.error("media request: TMDB lookup failed:", (e as Error).message);
        return fail("failed");
    }

    return writeRequest("media_request_add", {
        p_user: member.id,
        p_media_type: "movie",
        p_tmdb_id: id.data,
        p_weekly_quota: member.weeklyQuota,
        // Only when given, so plain requests also work while the database catches up.
        ...(extra.data.note && { p_note: extra.data.note }),
        ...(extra.data.temporary && { p_remove_after_days: REMOVE_AFTER_DAYS }),
    });
}

/** Cancel your own request, handing it to the earliest eligible follower if there is one. */
export async function cancelRequest(requestId: number): Promise<RequestActionResult> {
    return changeRequest("media_request_cancel", requestId);
}

/** Keep your requested title in the library after all. */
export async function keepRequest(requestId: number): Promise<RequestActionResult> {
    return changeRequest("media_request_keep", requestId);
}

/** Take back your "+1". */
export async function unfollowRequest(requestId: number): Promise<RequestActionResult> {
    return changeRequest("media_request_unfollow", requestId);
}

async function changeRequest(fn: string, requestId: number): Promise<RequestActionResult> {
    const member = await currentMember();
    if (!member) return fail("not_member");
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return fail("not_found");
    return writeRequest(fn, { p_user: member.id, p_request_id: id.data });
}

/** Database functions check the current state and make each change in one transaction. */
async function writeRequest(
    fn: string,
    args: Record<string, unknown>
): Promise<RequestActionResult> {
    const { data: outcome, error } = await createAdminClient().rpc(fn, args);
    if (error) return failed(fn, error);
    switch (outcome) {
        case "requested":
        case "reopened":
        case "followed":
        case "cancelled":
        case "handed_over":
        case "unfollowed":
        case "kept":
            return done(outcome);
        case "already_requested":
        case "already_following":
        case "available":
        case "closed":
            return done(outcome, false);
        case "quota_exceeded":
            return fail(outcome);
        case "not_cancellable":
        case "changed":
            return unchanged(outcome);
        default:
            return failed(fn, { message: "unexpected outcome " + String(outcome) });
    }
}

/** The signed-in user, if they have active access. */
async function currentMember(): Promise<Member | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const membership = await getOwnMembership(user);
    if (!membership?.active) return null;
    return { id: user.id, weeklyQuota: membership.weeklyQuota };
}

/** A change was made (or, with `changed = false`, the state was already as asked). */
function done(outcome: RequestOutcome, changed = true): RequestActionResult {
    if (changed) refresh();
    return { ok: true, outcome };
}

/** Nothing matched the expected state: show the current one. */
function unchanged(error: RequestError): RequestActionResult {
    refresh();
    return fail(error);
}

function failed(step: string, error: { message: string }): RequestActionResult {
    console.error(`media request: ${step} failed:`, error.message);
    return fail("failed");
}

function fail(error: RequestError): RequestActionResult {
    return { ok: false, error };
}
