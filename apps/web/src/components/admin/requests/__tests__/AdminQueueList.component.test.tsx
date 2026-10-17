import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import no from "@/messages/no.json";
import { AdminQueueList } from "../AdminQueueList";
import type { QueueItem } from "@/lib/media/queue.server";
vi.mock("next-intl/server", async () => {
    // The setup's next-intl mock is a plain function, so it serves the server API too.
    const { useTranslations: translator } = await import("next-intl");
    return {
        getTranslations: async ({ namespace }: { namespace: string }) => translator(namespace),
    };
});
vi.mock("@/lib/admin/mediaQueue.actions", () => ({
    adminRequestAction: vi.fn(),
    approveRequestOption: vi.fn(),
    setProcessingPaused: vi.fn(),
}));

const proposal: QueueItem = {
    id: 7,
    tmdbId: 1,
    title: "A movie",
    year: "1995",
    posterPath: null,
    status: "proposed",
    detail: null,
    statusDetail: "Needs a choice: no release from a listed group",
    requester: { name: "Member", isYou: false },
    followerCount: 0,
    role: null,
    createdAt: "2026-10-13T20:00:00Z",
    updatedAt: "2026-10-13T20:00:00.123456Z",
};
beforeEach(() => {
    setIntl({ locale: "en", messages: en });
});

it("translates admin details and retains the fallback for unknown worker codes", async () => {
    setIntl({ locale: "no", messages: no });
    render(
        await AdminQueueList({
            items: [
                {
                    ...proposal,
                    detail: {
                        code: "choice_cuts",
                        args: { group: "Group", cuts: "Theatrical, Director's Cut" },
                    },
                },
                {
                    ...proposal,
                    id: 8,
                    detail: { code: "future_code", args: {} },
                    statusDetail: "Future explanation",
                },
            ],
            heading: "Needs you",
            empty: "Nothing",
            locale: "no",
        })
    );
    expect(
        screen.getByText("Group har flere versjoner: Theatrical, Director's Cut")
    ).toBeInTheDocument();
    expect(screen.queryByText(proposal.statusDetail!)).toBeNull();
    expect(screen.getByText("Future explanation")).toBeInTheDocument();
});

it("shows a proposal's options with the worker's pick marked", async () => {
    const options = new Map([
        [
            7,
            [
                { rank: 1, label: "Group A · 2160p · 50 GB", reason: "listed group" },
                { rank: 2, label: "Group B · 1080p · 20 GB", reason: null },
            ],
        ],
    ]);
    render(
        await AdminQueueList({
            items: [proposal],
            options,
            heading: "Needs you",
            empty: "Nothing",
            locale: "en",
        })
    );

    expect(screen.getByText("Suggestion ready")).toBeInTheDocument();
    expect(screen.getByText(proposal.statusDetail!)).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Suggestions for A movie" })).getAllByRole(
        "listitem"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Group A · 2160p · 50 GB");
    expect(rows[0]).toHaveTextContent("Recommended");
    expect(rows[0]).toHaveTextContent("listed group");
    expect(rows[1]).not.toHaveTextContent("Recommended");
});

it("lets the admin choose each option when the worker adds what is chosen", async () => {
    const options = new Map([
        [
            7,
            [
                { rank: 1, label: "Group A · 2160p · 50 GB", reason: null },
                { rank: 2, label: "Group B · 1080p · 20 GB", reason: null },
            ],
        ],
    ]);
    const list = async (canChoose: boolean, items = [proposal]) =>
        render(
            await AdminQueueList({
                items,
                options,
                canChoose,
                heading: "Needs you",
                empty: "Nothing",
                locale: "en",
            })
        );

    const { unmount } = await list(true);
    const rows = within(screen.getByRole("list", { name: "Suggestions for A movie" })).getAllByRole(
        "listitem"
    );
    expect(
        within(rows[1]).getByRole("button", { name: "Choose Group B · 1080p · 20 GB for A movie" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Choose / })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Mark A movie available" })).toBeNull();
    unmount();

    // In a preview nothing would be added, and without options there is nothing to choose.
    const { unmount: unmountPreview } = await list(false);
    expect(screen.queryByRole("button", { name: /^Choose / })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark A movie available" })).toBeInTheDocument();
    unmountPreview();

    await list(true, [{ ...proposal, id: 8 }]);
    expect(screen.queryByRole("button", { name: /^Choose / })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark A movie available" })).toBeInTheDocument();
});

it("starts a collapsed list closed, showing its heading and count", async () => {
    const { container } = render(
        await AdminQueueList({
            items: [{ ...proposal, status: "available", statusDetail: null }],
            heading: "Available",
            empty: "Nothing",
            locale: "en",
            collapsed: true,
        })
    );

    const details = container.querySelector("details");
    expect(details).not.toHaveAttribute("open");
    expect(details?.querySelector("summary")).toHaveTextContent("Available1");
});
