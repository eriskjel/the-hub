import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import { ChooseOption, QueueControls, ProcessingToggle } from "../QueueControls";
import {
    adminRequestAction,
    approveRequestOption,
    setProcessingPaused,
} from "@/lib/admin/mediaQueue.actions";
import type { QueueItem } from "@/lib/media/queue.server";
import type { AdminMediaResult } from "@/lib/media/admin";
import { toast } from "sonner";
vi.mock("@/lib/admin/mediaQueue.actions", () => ({
    adminRequestAction: vi.fn(),
    approveRequestOption: vi.fn(),
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
    detail: null,
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

it.each(["searching", "downloading", "available"] as const)(
    "has no mutation buttons for %s",
    (status) => {
        render(<QueueControls item={{ ...item, status }} title="A movie" />);
        expect(screen.queryByRole("button")).toBeNull();
    }
);

const proposal: QueueItem = { ...item, status: "proposed" };
const openMenu = () =>
    fireEvent.click(screen.getByRole("button", { name: "More actions for A movie" }));

it("offers marking a proposal available first, with the overrides in the menu", () => {
    render(<QueueControls item={proposal} title="A movie" />);
    expect(screen.getByRole("button", { name: "Mark A movie available" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline A movie" })).toBeNull();

    openMenu();
    expect(screen.getByRole("button", { name: "Decline A movie" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search again for A movie" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark A movie available" })).toHaveLength(1);
});

it.each(["wanted", "approved"] as const)(
    "keeps every action in the menu while a %s request waits for the worker",
    (status) => {
        render(<QueueControls item={{ ...item, status }} title="A movie" />);
        expect(screen.getAllByRole("button")).toHaveLength(1);

        openMenu();
        for (const name of [
            "Mark A movie available",
            "Decline A movie",
            "Search again for A movie",
        ]) {
            expect(screen.getByRole("button", { name })).toBeInTheDocument();
        }
    }
);

it("moves marking available into the menu while the admin chooses an option", () => {
    render(<QueueControls item={proposal} title="A movie" choosing />);
    expect(screen.getAllByRole("button")).toHaveLength(1);

    openMenu();
    expect(screen.getByRole("button", { name: "Mark A movie available" })).toBeInTheDocument();
});

it("approves the chosen option against the displayed revision", async () => {
    vi.mocked(approveRequestOption).mockResolvedValueOnce({ ok: true, outcome: "approved" });
    render(<ChooseOption item={proposal} rank={2} label="Group · 1080p" title="A movie" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Group · 1080p for A movie" }));
    expect(approveRequestOption).toHaveBeenCalledWith(7, 2, item.updatedAt);
    await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Chosen. It will be added shortly.")
    );
});

it("closes the menu on Escape and returns focus to its button", () => {
    render(<QueueControls item={item} title="A movie" />);
    openMenu();
    const trigger = screen.getByRole("button", { name: "More actions for A movie" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Decline A movie" })).toBeNull();
    expect(trigger).toHaveFocus();
});

it("sends the displayed request revision and disables all row actions while saving", async () => {
    let resolve!: (result: AdminMediaResult) => void;
    vi.mocked(adminRequestAction).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        })
    );
    render(<QueueControls item={proposal} title="A movie" />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Decline A movie" }));
    expect(adminRequestAction).toHaveBeenCalledWith(7, "decline", item.updatedAt);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    await act(async () => {
        resolve({ ok: true, outcome: "declined" });
    });
    expect(toast.success).toHaveBeenCalledWith("Request declined.");
});

it("closes an open menu when the main action starts from the keyboard", () => {
    vi.mocked(adminRequestAction).mockReturnValueOnce(new Promise(() => {}));
    render(<QueueControls item={proposal} title="A movie" />);
    openMenu();
    // A keyboard press fires no mousedown outside the menu.
    fireEvent.click(screen.getByRole("button", { name: "Mark A movie available" }));

    expect(screen.queryByRole("button", { name: "Decline A movie" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions for A movie" })).toBeDisabled();
    expect(adminRequestAction).toHaveBeenCalledOnce();
});

it("reports a stale action without success", async () => {
    vi.mocked(adminRequestAction).mockResolvedValueOnce({ ok: false, error: "changed" });
    render(<QueueControls item={item} title="A movie" />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Search again for A movie" }));
    expect(adminRequestAction).toHaveBeenCalledWith(7, "requeue", item.updatedAt);
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
