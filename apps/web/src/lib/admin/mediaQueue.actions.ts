"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requestIdSchema } from "@/lib/media/request";
import type { AdminMediaResult } from "@/lib/media/admin";

const updateSchema = z.object({
    requestId: requestIdSchema,
    intent: z.enum(["decline", "requeue", "available"]),
    updatedAt: z.string().datetime({ offset: true }),
});

export async function adminRequestAction(
    requestId: number,
    intent: string,
    updatedAt: string
): Promise<AdminMediaResult> {
    await requireAdmin();
    const parsed = updateSchema.safeParse({ requestId, intent, updatedAt });
    if (!parsed.success) return { ok: false, error: "not_allowed" };
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

/** Approves one of the proposed options; the worker then adds it. */
export async function approveRequestOption(
    requestId: number,
    rank: number,
    updatedAt: string
): Promise<AdminMediaResult> {
    await requireAdmin();
    const parsed = approveSchema.safeParse({ requestId, rank, updatedAt });
    if (!parsed.success) return { ok: false, error: "not_allowed" };
    return write("media_request_admin_approve", {
        p_request_id: parsed.data.requestId,
        p_rank: parsed.data.rank,
        p_expected_updated_at: parsed.data.updatedAt,
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
        case "paused":
        case "resumed":
            refresh();
            return { ok: true, outcome: data };
        case "changed":
        case "not_allowed":
            refresh();
            return { ok: false, error: data };
        default:
            return { ok: false, error: "failed" };
    }
}
