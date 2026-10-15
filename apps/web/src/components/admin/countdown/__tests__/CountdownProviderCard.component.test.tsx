import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import { fetchJson } from "@/lib/widgets/fetchJson";
import CountdownProviderCard from "../CountdownProviderCard";

vi.mock("@/lib/widgets/fetchJson", () => ({ fetchJson: vi.fn() }));
const status = {
    providerId: "trippel-trumf",
    nextIso: "2026-11-05T08:00:00Z",
    tentative: true,
    adminConfirmed: false,
};
beforeEach(() => {
    vi.resetAllMocks();
    setIntl({ locale: "en", messages: en });
});

it("announces failed confirmation and leaves the current date visible for retry", async () => {
    vi.mocked(fetchJson).mockRejectedValueOnce(new Error("unavailable"));
    render(
        <CountdownProviderCard
            providerId="trippel-trumf"
            initialStatus={status}
            initialDenied={[]}
        />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm date" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update this provider");
    expect(screen.getByText(/November 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm date" })).toBeEnabled();
});

it("lets the admin cancel flagging a date without sending a mutation", () => {
    render(
        <CountdownProviderCard
            providerId="trippel-trumf"
            initialStatus={status}
            initialDenied={[]}
        />
    );
    fireEvent.click(screen.getByRole("button", { name: "Flag as wrong" }));
    expect(screen.getByText(en.admin.widgets.countdown.denyConfirm)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(en.admin.widgets.countdown.denyConfirm)).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
});

it("refreshes both status and flagged dates after a successful change", async () => {
    vi.mocked(fetchJson)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...status, adminConfirmed: true })
        .mockResolvedValueOnce([]);
    render(
        <CountdownProviderCard
            providerId="trippel-trumf"
            initialStatus={status}
            initialDenied={[]}
        />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm date" }));
    await waitFor(() =>
        expect(screen.getByRole("button", { name: "Remove confirmation" })).toBeEnabled()
    );
    expect(screen.getByRole("status")).toHaveTextContent("Up to date.");
    expect(fetchJson).toHaveBeenCalledTimes(3);
});

it("closes an open flag prompt when another action starts, so a changed date needs a new confirmation", async () => {
    vi.mocked(fetchJson)
        .mockResolvedValueOnce({ ...status, nextIso: "2026-11-12T08:00:00Z" })
        .mockResolvedValueOnce([]);
    render(
        <CountdownProviderCard
            providerId="trippel-trumf"
            initialStatus={status}
            initialDenied={[]}
        />
    );
    fireEvent.click(screen.getByRole("button", { name: "Flag as wrong" }));
    expect(screen.getByText(en.admin.widgets.countdown.denyConfirm)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Trippel-Trumf" }));
    expect(screen.queryByText(en.admin.widgets.countdown.denyConfirm)).toBeNull();
    expect(await screen.findByText(/November 12/)).toBeInTheDocument();
    expect(fetchJson).toHaveBeenCalledTimes(2);
});
