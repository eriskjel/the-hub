"use server";

import { refresh } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { DEFAULT_LOCALE } from "@/i18n/routing";
import { getOwnMembership } from "@/lib/media/membership.server";
import { getMovie } from "@/lib/media/tmdb.server";
import {
    CANCELLABLE_STATUSES,
    isOpenStatus,
    requestIdSchema,
    tmdbIdSchema,
    type RequestActionResult,
    type RequestError,
    type RequestOutcome,
    type RequestStatus,
} from "@/lib/media/request";

/** `weeklyQuota` null: no limit (admins). */
type Member = { id: string; weeklyQuota: number | null };
type ExistingRequest = { id: number; status: RequestStatus; requested_by: string | null };

/*
 * Members' write path for the shared request queue. Users have no write
 * policies on the media tables, so every change goes through here: the
 * session and an active membership are checked first, then the service role
 * writes. The client sends only ids; everything else comes from the database
 * or from TMDB. Writes that depend on a row's state are conditional on it.
 */

/** Request a movie, or "+1" it if someone else already has. */
export async function requestMovie(tmdbId: number): Promise<RequestActionResult> {
    const member = await currentMember();
    if (!member) return fail("not_member");

    const id = tmdbIdSchema.safeParse(tmdbId);
    if (!id.success) return fail("not_found");

    try {
        if (!(await getMovie(id.data, DEFAULT_LOCALE))) return fail("not_found");
    } catch (e) {
        console.error("media request: TMDB lookup failed:", (e as Error).message);
        return fail("failed");
    }

    const admin = createAdminClient();
    // Two passes: if someone else's request appears while we add ours, the
    // second pass "+1"s it instead.
    for (let attempt = 0; attempt < 2; attempt++) {
        const { data: existing, error } = await admin
            .from("media_request")
            .select("id, status, requested_by")
            .eq("media_type", "movie")
            .eq("tmdb_id", id.data)
            .maybeSingle<ExistingRequest>();
        if (error) return failed("read", error);

        if (!existing || existing.status === "cancelled") {
            // Creating or reopening a request uses the quota, so the database
            // checks it and writes in one step.
            const { data: outcome, error: addError } = await admin.rpc("media_request_add", {
                p_user: member.id,
                p_media_type: "movie",
                p_tmdb_id: id.data,
                p_weekly_quota: member.weeklyQuota,
            });
            if (addError) return failed("add", addError);
            if (outcome === "requested" || outcome === "reopened") return done(outcome);
            if (outcome === "quota_exceeded") return fail("quota_exceeded");
            if (outcome === "exists") continue;
            return failed("add", { message: `unexpected outcome ${String(outcome)}` });
        }

        return joinExisting(member, existing);
    }
    return fail("changed");
}

/** Cancel your own request. Someone who "+1"ed it takes it over instead, if anyone did. */
export async function cancelRequest(requestId: number): Promise<RequestActionResult> {
    const member = await currentMember();
    if (!member) return fail("not_member");
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return fail("not_found");

    const admin = createAdminClient();
    const next = await earliestActiveFollower(id.data, member.id);
    if (next === undefined) return fail("failed");

    // Only the requester, and only while nothing has been added.
    const change = next ? { requested_by: next.user_id } : { status: "cancelled" };
    const { data, error } = await admin
        .from("media_request")
        .update(change)
        .eq("id", id.data)
        .eq("requested_by", member.id)
        .in("status", CANCELLABLE_STATUSES)
        .select("id");
    if (error) return failed("cancel", error);
    if (!data?.length) return unchanged("not_cancellable");

    if (next) {
        const { error: deleteError } = await admin
            .from("media_request_follower")
            .delete()
            .eq("request_id", id.data)
            .eq("user_id", next.user_id);
        // The new requester is still listed as a follower too; harmless, so
        // only log it.
        if (deleteError) {
            console.error("media request: follower cleanup failed:", deleteError.message);
        }
        return done("handed_over");
    }
    return done("cancelled");
}

/** Take back your "+1". */
export async function unfollowRequest(requestId: number): Promise<RequestActionResult> {
    const member = await currentMember();
    if (!member) return fail("not_member");
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return fail("not_found");

    const { data, error } = await createAdminClient()
        .from("media_request_follower")
        .delete()
        .eq("request_id", id.data)
        .eq("user_id", member.id)
        .select("user_id");
    if (error) return failed("unfollow", error);
    if (!data?.length) return unchanged("changed");
    return done("unfollowed");
}

async function joinExisting(
    member: Member,
    existing: ExistingRequest
): Promise<RequestActionResult> {
    if (existing.status === "available") return done("available", false);
    if (existing.status === "failed" || existing.status === "declined") {
        return done("closed", false);
    }

    if (!isOpenStatus(existing.status)) return fail("failed");
    if (existing.requested_by === member.id) return done("already_requested", false);

    const { data, error } = await createAdminClient()
        .from("media_request_follower")
        .upsert(
            { request_id: existing.id, user_id: member.id },
            { onConflict: "request_id,user_id", ignoreDuplicates: true }
        )
        .select("user_id");
    if (error) return failed("follow", error);
    if (!data?.length) return done("already_following", false);
    return done("followed");
}

/**
 * The follower who takes over a cancelled request: the earliest "+1" from
 * someone else who still has access. Null if there is none, undefined on error.
 */
async function earliestActiveFollower(
    requestId: number,
    requesterId: string
): Promise<{ user_id: string } | null | undefined> {
    const admin = createAdminClient();
    const { data: followers, error } = await admin
        .from("media_request_follower")
        .select("user_id")
        .eq("request_id", requestId)
        .neq("user_id", requesterId)
        .order("created_at", { ascending: true })
        .order("user_id", { ascending: true });
    if (error) {
        console.error("media request: follower read failed:", error.message);
        return undefined;
    }
    if (!followers?.length) return null;

    const { data: active, error: memberError } = await admin
        .from("media_member")
        .select("user_id")
        .in(
            "user_id",
            followers.map((f) => f.user_id)
        )
        .is("revoked_at", null);
    if (memberError) {
        console.error("media request: follower membership read failed:", memberError.message);
        return undefined;
    }
    const activeIds = new Set((active ?? []).map((m) => m.user_id));
    return followers.find((f) => activeIds.has(f.user_id)) ?? null;
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
