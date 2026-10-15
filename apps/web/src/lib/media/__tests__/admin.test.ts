import { expect, it } from "vitest";
import { adminRequestIntents, workerState, type WorkerStatus } from "../admin";
import { REQUEST_STATUSES } from "../request";

const now = Date.parse("2026-10-13T20:00:00Z");
const worker: WorkerStatus = {
    paused: false,
    mode: "auto",
    lastRunAt: new Date(now).toISOString(),
    detail: null,
};

it("protects active processing and available titles from admin changes", () => {
    for (const status of ["searching", "approved", "downloading", "available"] as const) {
        expect(adminRequestIntents(status)).toEqual([]);
    }
    for (const status of REQUEST_STATUSES.filter((s) =>
        ["wanted", "proposed", "failed", "declined", "cancelled"].includes(s)
    )) {
        expect(adminRequestIntents(status)).toContain("requeue");
        expect(adminRequestIntents(status)).toContain("available");
    }
});

it("tells a manual pause, a missing heartbeat and an update older than an hour apart", () => {
    expect(workerState(worker, now)).toBe("running");
    expect(workerState({ ...worker, paused: true }, now)).toBe("paused");
    expect(workerState({ ...worker, paused: true, lastRunAt: null }, now)).toBe("paused");
    expect(workerState({ ...worker, lastRunAt: null }, now)).toBe("notStarted");
    expect(workerState({ ...worker, lastRunAt: "bad-date" }, now)).toBe("stale");
    expect(
        workerState({ ...worker, lastRunAt: new Date(now - 60 * 60 * 1000).toISOString() }, now)
    ).toBe("running");
    expect(
        workerState({ ...worker, lastRunAt: new Date(now - 60 * 60 * 1000 - 1).toISOString() }, now)
    ).toBe("stale");
});
