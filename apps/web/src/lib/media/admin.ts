import type { RequestStatus } from "@/lib/media/request";

export type AdminRequestIntent = "decline" | "requeue" | "available";
export type AdminMediaResult =
    | { ok: true; outcome: "declined" | "requeued" | "available" | "paused" | "resumed" }
    | { ok: false; error: "changed" | "not_allowed" | "failed" };

/** Mirrors the state transitions allowed by media_request_admin_update. */
export function adminRequestIntents(status: RequestStatus): AdminRequestIntent[] {
    switch (status) {
        case "wanted":
        case "proposed":
        case "failed":
            return ["available", "decline", "requeue"];
        case "declined":
        case "cancelled":
            return ["available", "requeue"];
        default:
            return [];
    }
}

export type WorkerStatus = {
    paused: boolean;
    mode: "dry" | "review" | "auto" | null;
    lastRunAt: string | null;
    detail: string | null;
};

const HEARTBEAT_MAX_AGE_MS = 60 * 60 * 1000;

export function processingPaused(worker: WorkerStatus, now = Date.now()): boolean {
    const lastRun = worker.lastRunAt ? Date.parse(worker.lastRunAt) : Number.NaN;
    return worker.paused || !Number.isFinite(lastRun) || now - lastRun > HEARTBEAT_MAX_AGE_MS;
}
