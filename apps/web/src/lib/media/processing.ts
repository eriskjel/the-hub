import { workerState, type WorkerStatus } from "@/lib/media/admin";

const MESSAGES = {
    paused: "processing.paused",
    stale: "processing.paused",
    notStarted: "processing.notStarted",
    running: "processing.active",
} as const;

/** What members read about processing, without the admin details. */
export function memberProcessingMessage(worker: WorkerStatus, now = Date.now()) {
    const state = workerState(worker, now);
    // A preview run adds nothing yet, so requests are still only collected.
    if (state === "running" && worker.mode === "dry") return MESSAGES.notStarted;
    return MESSAGES[state];
}
