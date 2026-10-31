import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import { RetentionProvider, ApprovalRetention, RetentionDialog } from "../RetentionControls";
import { ChooseOption, QueueControls } from "../QueueControls";
import { RequestControls } from "@/components/requests/RequestControls";
import { approveRequestOption, setRequestRetention } from "@/lib/admin/mediaQueue.actions";
import type { QueueItem } from "@/lib/media/queue.server";
vi.mock("@/lib/admin/mediaQueue.actions", () => ({
    approveRequestOption: vi.fn(),
    setRequestRetention: vi.fn(),
    adminRequestAction: vi.fn(),
    setProcessingPaused: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/media/requests.actions", () => ({
    requestMovie: vi.fn(),
    keepRequest: vi.fn(),
    cancelRequest: vi.fn(),
    unfollowRequest: vi.fn(),
}));
const item: QueueItem = {
    id: 7,
    tmdbId: 1,
    title: "A movie",
    year: null,
    posterPath: null,
    status: "proposed",
    detail: null,
    statusDetail: null,
    requester: null,
    notes: [],
    removal: null,
    followerCount: 2,
    role: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-31T12:00:00Z",
    retention: { policy: "requester", days: null, by: null, eligible: true },
};
beforeEach(() => {
    vi.clearAllMocks();
    setIntl({ locale: "en", messages: en });
});

it("submits release and chosen custom duration together", async () => {
    vi.mocked(approveRequestOption).mockResolvedValue({ ok: true, outcome: "approved" });
    render(
        <RetentionProvider item={item}>
            <ApprovalRetention />
            <ChooseOption item={item} rank={2} label="Release" title="A movie" />
        </RetentionProvider>
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "remove" } });
    expect(screen.getByRole("spinbutton")).toHaveValue(30);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose Release for A movie" }));
    await waitFor(() =>
        expect(approveRequestOption).toHaveBeenCalledWith(7, 2, item.updatedAt, {
            policy: "remove",
            days: 45,
        })
    );
});

it("blocks approval for invalid durations and supports the keep inverse", async () => {
    vi.mocked(approveRequestOption).mockResolvedValue({ ok: true, outcome: "approved" });
    render(
        <RetentionProvider item={item}>
            <ApprovalRetention />
            <ChooseOption item={item} rank={1} label="Release" title="A movie" />
        </RetentionProvider>
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "remove" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Choose Release for A movie" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "keep" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose Release for A movie" }));
    await waitFor(() =>
        expect(approveRequestOption).toHaveBeenCalledWith(7, 1, item.updatedAt, { policy: "keep" })
    );
});

it("allows editing an available permanent title and explains the new countdown", async () => {
    vi.mocked(setRequestRetention).mockResolvedValue({ ok: true, outcome: "retention_saved" });
    render(<QueueControls item={{ ...item, status: "available" }} title="A movie" />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for A movie" }));
    fireEvent.click(screen.getByRole("button", { name: "Library retention…" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "remove" } });
    expect(screen.getByText(en.admin.requests.retention.fromNow)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
        expect(setRequestRetention).toHaveBeenCalledWith(7, item.updatedAt, {
            policy: "remove",
            days: 7,
        })
    );
});

it("does not offer deletion for a release the worker cannot remove", () => {
    render(
        <RetentionDialog
            item={{
                ...item,
                status: "available",
                retention: { ...item.retention!, eligible: false },
            }}
            title="A movie"
            onClose={() => {}}
        />
    );
    expect(screen.getByRole("option", { name: "Remove after…" })).toBeDisabled();
});

it("hides the requester Keep button for an admin deletion override", () => {
    render(
        <RequestControls
            tmdbId={1}
            title="A movie"
            request={{
                id: 7,
                status: "available",
                role: "requester",
                removal: { at: "2026-11-30T12:00:00Z" },
                retention: { policy: "remove", days: 30, by: "Erik", eligible: true },
            }}
        />
    );
    expect(screen.queryByRole("button")).toBeNull();
});
