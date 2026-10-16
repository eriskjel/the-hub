import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import { QueueList } from "../QueueList";
import type { QueueItem } from "@/lib/media/queue.server";

vi.mock("@/lib/media/requests.actions", () => ({
    requestMovie: vi.fn(),
    cancelRequest: vi.fn(),
    unfollowRequest: vi.fn(),
}));

const item = (id: number, status: QueueItem["status"], statusDetail: string): QueueItem => ({
    id,
    tmdbId: id,
    title: `Movie ${id}`,
    year: null,
    posterPath: null,
    status,
    statusDetail,
    requester: { name: null, isYou: true },
    followerCount: 0,
    role: "requester",
    createdAt: "2026-10-13T20:00:00Z",
    updatedAt: "2026-10-13T20:00:00Z",
});

beforeEach(() => {
    setIntl({ locale: "en", messages: en });
});

it("leaves a proposal's details to the admin and shows other status notes", () => {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <QueueList
                heading="Queue"
                items={[
                    item(1, "proposed", "Suggested: Group · 2160p · 50 GB"),
                    item(2, "wanted", "Waiting for digital release, 12 Nov"),
                ]}
            />
        </QueryClientProvider>
    );

    expect(screen.getByText("Awaiting admin approval")).toBeInTheDocument();
    expect(screen.queryByText("Suggested: Group · 2160p · 50 GB")).toBeNull();
    expect(screen.getByText("Waiting for digital release, 12 Nov")).toBeInTheDocument();
});
