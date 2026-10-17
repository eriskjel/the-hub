import { isKeepable, type RequestStatus } from "@/lib/media/request";

export type AdminRequestIntent = "decline" | "requeue" | "available" | "keep";
export type AdminMediaResult =
    | {
          ok: true;
          outcome:
              | "declined"
              | "requeued"
              | "available"
              | "approved"
              | "kept"
              | "paused"
              | "resumed";
      }
    | { ok: false; error: "changed" | "not_allowed" | "failed" };

/** Waiting for an admin: a proposal to act on, or a search that gave up. */
export const NEEDS_ADMIN_STATUSES: readonly RequestStatus[] = ["proposed", "failed"];

/**
 * Mirrors the state transitions allowed by media_request_admin_update. A
 * temporary title can also be kept while its removal is still ahead.
 */
export function adminRequestIntents(
    status: RequestStatus,
    temporary = false
): AdminRequestIntent[] {
    const keep: AdminRequestIntent[] = temporary && isKeepable(status) ? ["keep"] : [];
    return [...statusIntents(status), ...keep];
}

function statusIntents(status: RequestStatus): AdminRequestIntent[] {
    switch (status) {
        case "wanted":
        case "proposed":
        case "approved":
        case "failed":
            return ["available", "decline", "requeue"];
        case "declined":
        case "cancelled":
        case "removed":
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

/** Choosing an option only leads somewhere once the worker adds what is chosen. */
export function canChooseOptions(worker: WorkerStatus): boolean {
    return worker.mode === "review" || worker.mode === "auto";
}

export type WorkerState = "paused" | "notStarted" | "stale" | "running";

const HEARTBEAT_MAX_AGE_MS = 60 * 60 * 1000;

/** Paused by an admin, no update yet, no update for over an hour, or running. */
export function workerState(worker: WorkerStatus, now = Date.now()): WorkerState {
    if (worker.paused) return "paused";
    if (!worker.lastRunAt) return "notStarted";
    const lastRun = Date.parse(worker.lastRunAt);
    return !Number.isFinite(lastRun) || now - lastRun > HEARTBEAT_MAX_AGE_MS ? "stale" : "running";
}
