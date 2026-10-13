import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import { QueueControls, ProcessingToggle } from "../QueueControls";
import { adminRequestAction, setProcessingPaused } from "@/lib/admin/mediaQueue.actions";
import type { QueueItem } from "@/lib/media/queue.server";
import type { AdminMediaResult } from "@/lib/media/admin";
import { toast } from "sonner";
vi.mock("@/lib/admin/mediaQueue.actions", () => ({
    adminRequestAction: vi.fn(),
    setProcessingPaused: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item: QueueItem = {
    id: 7,
    tmdbId: 1,
    title: "A movie",
    year: null,
    posterPath: null,
    status: "wanted",
    statusDetail: null,
    requester: null,
    followerCount: 0,
    role: null,
    createdAt: "2026-10-13T20:00:00Z",
    updatedAt: "2026-10-13T20:00:00.123456Z",
};
beforeEach(() => {
    vi.clearAllMocks();
    setIntl({ locale: "en", messages: en });
});

it.each(["searching", "approved", "downloading", "available"] as const)(
    "has no mutation buttons for %s",
    (status) => {
        render(<QueueControls item={{ ...item, status }} title="A movie" />);
        expect(screen.queryByRole("button")).toBeNull();
    }
);

it("sends the displayed request revision and disables all row actions while saving", async () => {
    let resolve!: (result: AdminMediaResult) => void;
    vi.mocked(adminRequestAction).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        })
    );
    render(<QueueControls item={item} title="A movie" />);
    fireEvent.click(screen.getByRole("button", { name: "Decline A movie" }));
    expect(adminRequestAction).toHaveBeenCalledWith(7, "decline", item.updatedAt);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    await act(async () => {
        resolve({ ok: true, outcome: "declined" });
    });
    expect(toast.success).toHaveBeenCalledWith("Request declined.");
});

it("reports a stale action without success", async () => {
    vi.mocked(adminRequestAction).mockResolvedValueOnce({ ok: false, error: "changed" });
    render(<QueueControls item={item} title="A movie" />);
    fireEvent.click(screen.getByRole("button", { name: "Re-queue A movie" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.admin.requests.errors.changed));
    expect(toast.success).not.toHaveBeenCalled();
});

it("resumes only the pause state the admin saw", async () => {
    vi.mocked(setProcessingPaused).mockResolvedValueOnce({ ok: true, outcome: "resumed" });
    render(<ProcessingToggle paused />);
    fireEvent.click(screen.getByRole("button", { name: "Resume processing" }));
    expect(setProcessingPaused).toHaveBeenCalledWith(false, true);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Processing resumed."));
});
