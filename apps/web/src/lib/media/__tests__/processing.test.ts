import { expect, it } from "vitest";
import type { WorkerStatus } from "../admin";
import { memberProcessingMessage } from "../processing";

const now = Date.parse("2026-10-15T20:00:00Z");
const running: WorkerStatus = {
    paused: false,
    mode: "auto",
    lastRunAt: new Date(now - 60_000).toISOString(),
    detail: null,
};

it("says requests are processed automatically only once titles are added", () => {
    expect(memberProcessingMessage(running, now)).toBe("processing.active");
    expect(memberProcessingMessage({ ...running, mode: "review" }, now)).toBe("processing.active");
    expect(memberProcessingMessage({ ...running, mode: "dry" }, now)).toBe("processing.notStarted");
});

it("says processing is paused when an admin paused it or it stopped reporting", () => {
    expect(memberProcessingMessage({ ...running, paused: true }, now)).toBe("processing.paused");
    expect(
        memberProcessingMessage(
            { ...running, lastRunAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
            now
        )
    ).toBe("processing.paused");
});

it("says processing is still being built before the first report", () => {
    expect(memberProcessingMessage({ ...running, mode: null, lastRunAt: null }, now)).toBe(
        "processing.notStarted"
    );
});
