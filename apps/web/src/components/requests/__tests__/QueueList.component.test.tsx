import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import no from "@/messages/no.json";
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
    detail: null,
    statusDetail,
    requester: { name: null, isYou: true },
    notes: [],
    followerCount: 0,
    role: "requester",
    createdAt: "2026-10-13T20:00:00Z",
    updatedAt: "2026-10-13T20:00:00Z",
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
    setIntl({ locale: "en", messages: en });
});
afterEach(() => vi.useRealTimers());

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

it("renders Norwegian dates, hides admin-only fallbacks and escapes worker values", () => {
    setIntl({ locale: "no", messages: no });
    const items: QueueItem[] = [
        {
            ...item(1, "wanted", "English date"),
            detail: { code: "no_releases", args: { next: "2026-10-17T12:00:00Z" } },
        },
        { ...item(2, "wanted", "Admin-only fallback"), detail: { code: "not_cached", args: null } },
        {
            ...item(3, "available", "Old label"),
            detail: { code: "release", args: { label: '<img src=x onerror="alert(1)">' } },
        },
    ];
    const { container } = render(
        <QueryClientProvider client={new QueryClient()}>
            <QueueList heading="Queue" items={items} />
        </QueryClientProvider>
    );
    expect(
        screen.getByText("Ingen utgivelser ennå, sjekker igjen lør. 17. okt.")
    ).toBeInTheDocument();
    expect(screen.queryByText("English date")).toBeNull();
    expect(screen.queryByText("Admin-only fallback")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(container.querySelector("[onerror]")).toBeNull();
});

it("shows your own note under the request", () => {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <QueueList
                heading="Queue"
                items={[
                    {
                        ...item(1, "wanted", ""),
                        notes: [{ author: { name: "Me", isYou: true }, text: "The extended cut" }],
                    },
                    {
                        ...item(2, "wanted", ""),
                        notes: [{ author: { name: "Other", isYou: false }, text: "Not mine" }],
                    },
                ]}
            />
        </QueryClientProvider>
    );

    expect(screen.getByText("Your note: The extended cut")).toBeInTheDocument();
    expect(screen.queryByText(/Not mine/)).toBeNull();
});
