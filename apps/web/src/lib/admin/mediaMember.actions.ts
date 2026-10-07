"use server";

import { refresh } from "next/cache";
import { z, type ZodError } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { isAdminFromUser } from "@/lib/auth/isAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import {
    memberFormSchema,
    type MemberActionError,
    type MemberActionState,
} from "@/lib/media/member";

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

/**
 * Admin form action for request access:
 * - `grant` gives access afresh (a revoked row becomes a new grant).
 * - `update` changes the account and quota of an active member, keeping the
 *   original grant.
 * - `revoke` ends access but keeps the row as history.
 * `update` and `revoke` only touch an active membership, in a single write, and
 * report `not_active` when there was none (e.g. it was revoked meanwhile).
 * Users never write media_member themselves (RLS has no write policies), so this
 * goes through the service role after requireAdmin.
 */
export async function mediaMemberAction(
    _prev: MemberActionState,
    formData: FormData
): Promise<MemberActionState> {
    const { user: actor } = await requireAdmin();

    const intent = formData.get("intent");
    switch (intent) {
        case "grant":
        case "update":
            return save(intent, actor.id, formData);
        case "revoke":
            return revoke(formData);
        default:
            return fail("failed");
    }
}

async function save(
    intent: "grant" | "update",
    actorId: string,
    formData: FormData
): Promise<MemberActionState> {
    const parsed = memberFormSchema.safeParse({
        userId: formData.get("userId"),
        libraryAccount: formData.get("libraryAccount"),
        weeklyQuota: formData.get("weeklyQuota"),
    });
    if (!parsed.success) return fail(formError(parsed.error));
    const { userId, libraryAccount, weeklyQuota } = parsed.data;

    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError?.status === 404 || (!targetError && !target.user)) return fail("not_found");
    if (targetError) {
        console.error("media member: user lookup failed:", targetError.message);
        return fail("failed");
    }
    if (!libraryAccount && !isAdminFromUser(target.user)) return fail("account_required");

    if (intent === "grant") {
        const { error } = await admin.from("media_member").upsert({
            user_id: userId,
            library_account: libraryAccount,
            weekly_quota: weeklyQuota,
            granted_by: actorId,
            granted_at: new Date().toISOString(),
            revoked_at: null,
        });
        if (error) return writeFailure(error);
    } else {
        const { data, error } = await admin
            .from("media_member")
            .update({ library_account: libraryAccount, weekly_quota: weeklyQuota })
            .eq("user_id", userId)
            .is("revoked_at", null)
            .select("user_id");
        if (error) return writeFailure(error);
        if (!data?.length) return notActive();
    }

    refresh();
    return { status: "saved" };
}

async function revoke(formData: FormData): Promise<MemberActionState> {
    const userId = z.string().uuid().safeParse(formData.get("userId"));
    if (!userId.success) return fail("not_found");

    const { data, error } = await createAdminClient()
        .from("media_member")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId.data)
        .is("revoked_at", null)
        .select("user_id");
    if (error) {
        console.error("media member: revoke failed:", error.message);
        return fail("failed");
    }
    if (!data?.length) return notActive();

    refresh();
    return { status: "revoked" };
}

function writeFailure(error: { code?: string; message: string }): MemberActionState {
    if (error.code === PG_UNIQUE_VIOLATION) return fail("account_taken");
    if (error.code === PG_FOREIGN_KEY_VIOLATION) return fail("not_found");
    console.error("media member: save failed:", error.message);
    return fail("failed");
}

/** Nothing matched: show the current state instead of the stale one. */
function notActive(): MemberActionState {
    refresh();
    return fail("not_active");
}

function formError(error: ZodError): MemberActionError {
    const field = error.issues[0]?.path[0];
    if (field === "libraryAccount") return "invalid_account";
    if (field === "weeklyQuota") return "invalid_quota";
    return "not_found";
}

function fail(error: MemberActionError): MemberActionState {
    return { status: "error", error };
}
