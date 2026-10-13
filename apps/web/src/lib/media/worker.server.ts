import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerStatus } from "@/lib/media/admin";

export async function getWorkerStatus(client: SupabaseClient): Promise<WorkerStatus> {
    const { data, error } = await client
        .from("media_worker_status")
        .select("paused, mode, last_run_at, detail")
        .eq("id", true)
        .single();
    if (error || !data)
        throw new Error(`processing status read failed: ${error?.message ?? "missing status"}`);
    return {
        paused: data.paused,
        mode: data.mode,
        lastRunAt: data.last_run_at,
        detail: data.detail,
    };
}
