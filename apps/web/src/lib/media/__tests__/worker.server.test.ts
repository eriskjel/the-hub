import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "@/tests/fakeSupabase";
vi.mock("server-only", () => ({}));
import { getWorkerStatus } from "../worker.server";

it("maps the singleton worker status without writing", async () => {
    const db = fakeDb({
        media_worker_status: [
            {
                id: true,
                paused: true,
                mode: "dry",
                last_run_at: "2026-10-13T20:00:00Z",
                detail: "Healthy",
            },
        ],
    });
    expect(await getWorkerStatus(db as unknown as SupabaseClient)).toEqual({
        paused: true,
        mode: "dry",
        lastRunAt: "2026-10-13T20:00:00Z",
        detail: "Healthy",
    });
});

it("reports a missing or unreadable status instead of claiming processing is running", async () => {
    const db = fakeDb({ media_worker_status: [] });
    await expect(getWorkerStatus(db as unknown as SupabaseClient)).rejects.toThrow(
        "processing status read failed"
    );
    db.failNext("media_worker_status", "select");
    await expect(getWorkerStatus(db as unknown as SupabaseClient)).rejects.toThrow(
        "processing status read failed"
    );
});
