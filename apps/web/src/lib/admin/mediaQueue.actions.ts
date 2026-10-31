"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requestIdSchema } from "@/lib/media/request";
import type { AdminMediaResult } from "@/lib/media/admin";
import { retentionSchema, type RetentionChoice } from "@/lib/media/retention";

const updateSchema = z.object({
    requestId: requestIdSchema,
    intent: z.enum(["decline", "requeue", "available", "keep"]),
    updatedAt: z.string().datetime({ offset: true }),
});

export async function adminRequestAction(
    requestId: number,
    intent: string,
    updatedAt: string
): Promise<AdminMediaResult> {
    const { user } = await requireAdmin();
    const parsed = updateSchema.safeParse({ requestId, intent, updatedAt });
    if (!parsed.success) return { ok: false, error: "not_allowed" };
    // "Keep in library" is the admin's decision, which the requester can't undo.
    if (parsed.data.intent === "keep")
        return write("media_request_set_retention", {
            p_request_id: parsed.data.requestId,
            p_expected_updated_at: parsed.data.updatedAt,
            p_actor: user.id,
            p_policy: "keep",
            p_days: null,
        });
    return write("media_request_admin_update", {
        p_request_id: parsed.data.requestId,
        p_intent: parsed.data.intent,
        p_expected_updated_at: parsed.data.updatedAt,
    });
}

const approveSchema = z.object({
    requestId: requestIdSchema,
    rank: z.number().int().min(1).max(3),
    updatedAt: z.string().datetime({ offset: true }),
});

const retentionArgs = (choice: RetentionChoice) => ({
    p_policy: choice.policy,
    p_days: choice.policy === "remove" ? choice.days : null,
});

/**
 * Approves one of the proposed options; the worker then adds it. With a
 * retention choice, the admin's keep/remove decision is saved with it.
 */
export async function approveRequestOption(
    requestId: number,
    rank: number,
    updatedAt: string,
    retention?: RetentionChoice
): Promise<AdminMediaResult> {
    const { user } = await requireAdmin();
    const parsed = approveSchema
        .extend({ retention: retentionSchema.optional() })
        .safeParse({ requestId, rank, updatedAt, retention });
    if (!parsed.success) return { ok: false, error: "not_allowed" };
    const args = {
        p_request_id: parsed.data.requestId,
        p_rank: parsed.data.rank,
        p_expected_updated_at: parsed.data.updatedAt,
    };
    return parsed.data.retention
        ? write("media_request_approve_with_retention", {
              ...args,
              p_actor: user.id,
              ...retentionArgs(parsed.data.retention),
          })
        : write("media_request_admin_approve", args);
}

/** Sets whether a title stays in the library, overriding the requester and every +1. */
export async function setRequestRetention(
    requestId: number,
    updatedAt: string,
    retention: RetentionChoice
): Promise<AdminMediaResult> {
    const { user } = await requireAdmin();
    const parsed = approveSchema
        .omit({ rank: true })
        .extend({ retention: retentionSchema })
        .safeParse({ requestId, updatedAt, retention });
    if (!parsed.success) return { ok: false, error: "not_allowed" };
    return write("media_request_set_retention", {
        p_request_id: parsed.data.requestId,
        p_expected_updated_at: parsed.data.updatedAt,
        p_actor: user.id,
        ...retentionArgs(parsed.data.retention),
    });
}

export async function setProcessingPaused(
    paused: boolean,
    expectedPaused: boolean
): Promise<AdminMediaResult> {
    await requireAdmin();
    if (typeof paused !== "boolean" || typeof expectedPaused !== "boolean")
        return { ok: false, error: "not_allowed" };
    return write("media_worker_set_paused", {
        p_paused: paused,
        p_expected_paused: expectedPaused,
    });
}

async function write(fn: string, args: Record<string, unknown>): Promise<AdminMediaResult> {
    const { data, error } = await createAdminClient().rpc(fn, args);
    if (error) {
        console.error("admin requests: update failed:", error.message);
        return { ok: false, error: "failed" };
    }
    switch (data) {
        case "declined":
        case "requeued":
        case "available":
        case "approved":
        case "kept":
        case "retention_saved":
        case "paused":
        case "resumed":
            refresh();
            return { ok: true, outcome: data };
        case "changed":
        case "not_allowed":
        case "not_removable":
            refresh();
            return { ok: false, error: data };
        default:
            return { ok: false, error: "failed" };
    }
}
