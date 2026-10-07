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
 * Admin form action for request access. `intent=save` grants access, or updates
 * the account and quota of an active member; `intent=revoke` ends access but
 * keeps the row as history. Users never write media_member themselves (RLS has
 * no write policies), so this goes through the service role after requireAdmin.
 */
export async function mediaMemberAction(
    _prev: MemberActionState,
    formData: FormData
): Promise<MemberActionState> {
    const { user: actor } = await requireAdmin();

    switch (formData.get("intent")) {
        case "save":
            return save(actor.id, formData);
        case "revoke":
            return revoke(formData);
        default:
            return fail("failed");
    }
}

async function save(actorId: string, formData: FormData): Promise<MemberActionState> {
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

    const { data: existing, error: readError } = await admin
        .from("media_member")
        .select("revoked_at")
        .eq("user_id", userId)
        .maybeSingle();
    if (readError) {
        console.error("media member: read failed:", readError.message);
        return fail("failed");
    }

    // An active member keeps their original grant; anyone else gets a fresh one.
    const { error } =
        existing && existing.revoked_at === null
            ? await admin
                  .from("media_member")
                  .update({ library_account: libraryAccount, weekly_quota: weeklyQuota })
                  .eq("user_id", userId)
            : await admin.from("media_member").upsert({
                  user_id: userId,
                  library_account: libraryAccount,
                  weekly_quota: weeklyQuota,
                  granted_by: actorId,
                  granted_at: new Date().toISOString(),
                  revoked_at: null,
              });
    if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) return fail("account_taken");
        if (error.code === PG_FOREIGN_KEY_VIOLATION) return fail("not_found");
        console.error("media member: save failed:", error.message);
        return fail("failed");
    }

    refresh();
    return { status: "saved" };
}

async function revoke(formData: FormData): Promise<MemberActionState> {
    const userId = z.string().uuid().safeParse(formData.get("userId"));
    if (!userId.success) return fail("not_found");

    const { error } = await createAdminClient()
        .from("media_member")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId.data)
        .is("revoked_at", null);
    if (error) {
        console.error("media member: revoke failed:", error.message);
        return fail("failed");
    }

    refresh();
    return { status: "revoked" };
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
