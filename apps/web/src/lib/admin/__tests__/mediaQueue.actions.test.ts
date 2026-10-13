import { beforeEach, expect, it, vi } from "vitest";
const { requireAdmin, createAdmin, rpc, refresh } = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    createAdmin: vi.fn(),
    rpc: vi.fn(),
    refresh: vi.fn(),
}));
vi.mock("@/lib/auth/requireAdmin.server", () => ({ requireAdmin }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("next/cache", () => ({ refresh }));
import { adminRequestAction, setProcessingPaused } from "../mediaQueue.actions";

const revision = "2026-10-13T20:00:00.123456+00:00";
beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ user: { id: "admin" } });
    createAdmin.mockReturnValue({ rpc });
    rpc.mockResolvedValue({ data: "requeued", error: null });
});

it("passes the exact displayed revision to the transactional function", async () => {
    expect(await adminRequestAction(7, "requeue", revision)).toEqual({
        ok: true,
        outcome: "requeued",
    });
    expect(rpc).toHaveBeenCalledWith("media_request_admin_update", {
        p_request_id: 7,
        p_intent: "requeue",
        p_expected_updated_at: revision,
    });
    expect(refresh).toHaveBeenCalledOnce();
});

it.each(["decline", "available"])("reports successful %s actions", async (intent) => {
    rpc.mockResolvedValueOnce({
        data: intent === "decline" ? "declined" : "available",
        error: null,
    });
    expect((await adminRequestAction(7, intent, revision)).ok).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
});

it.each(["changed", "not_allowed"])("refreshes rejected %s actions", async (error) => {
    rpc.mockResolvedValueOnce({ data: error, error: null });
    expect(await adminRequestAction(7, "decline", revision)).toEqual({ ok: false, error });
    expect(refresh).toHaveBeenCalledOnce();
});

it.each([
    [0, "requeue", revision],
    [7, "approve", revision],
    [7, "decline", "bad-date"],
])("validates %j before writing", async (id, intent, date) => {
    expect(await adminRequestAction(id as number, intent as string, date as string)).toEqual({
        ok: false,
        error: "not_allowed",
    });
    expect(createAdmin).not.toHaveBeenCalled();
});

it.each([() => adminRequestAction(7, "requeue", revision), () => setProcessingPaused(true, false)])(
    "checks admin access before creating a privileged client",
    async (action) => {
        requireAdmin.mockRejectedValueOnce(new Error("denied"));
        await expect(action()).rejects.toThrow("denied");
        expect(createAdmin).not.toHaveBeenCalled();
    }
);

it("passes only pause values, preserving heartbeat fields", async () => {
    rpc.mockResolvedValueOnce({ data: "paused", error: null });
    expect(await setProcessingPaused(true, false)).toEqual({ ok: true, outcome: "paused" });
    expect(rpc).toHaveBeenCalledWith("media_worker_set_paused", {
        p_paused: true,
        p_expected_paused: false,
    });
});

it("rejects a malformed pause value", async () => {
    expect(await setProcessingPaused("true" as unknown as boolean, false)).toEqual({
        ok: false,
        error: "not_allowed",
    });
    expect(rpc).not.toHaveBeenCalled();
});

it("handles database errors and unknown outcomes without success", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    expect(await adminRequestAction(7, "requeue", revision)).toEqual({
        ok: false,
        error: "failed",
    });
    rpc.mockResolvedValueOnce({ data: "unexpected", error: null });
    expect(await adminRequestAction(7, "requeue", revision)).toEqual({
        ok: false,
        error: "failed",
    });
    expect(refresh).not.toHaveBeenCalled();
});
