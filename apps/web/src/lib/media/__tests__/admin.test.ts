import { expect, it } from "vitest";
import { adminRequestIntents, processingPaused, type WorkerStatus } from "../admin";
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

it("reports processing paused for a manual pause, missing heartbeat or update older than an hour", () => {
    expect(processingPaused(worker, now)).toBe(false);
    expect(processingPaused({ ...worker, paused: true }, now)).toBe(true);
    expect(processingPaused({ ...worker, lastRunAt: null }, now)).toBe(true);
    expect(processingPaused({ ...worker, lastRunAt: "bad-date" }, now)).toBe(true);
    expect(
        processingPaused(
            { ...worker, lastRunAt: new Date(now - 60 * 60 * 1000).toISOString() },
            now
        )
    ).toBe(false);
    expect(
        processingPaused(
            { ...worker, lastRunAt: new Date(now - 60 * 60 * 1000 - 1).toISOString() },
            now
        )
    ).toBe(true);
});
