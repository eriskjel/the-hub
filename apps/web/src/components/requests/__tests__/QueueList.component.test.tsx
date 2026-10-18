import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import no from "@/messages/no.json";
import { QueueList } from "../QueueList";
import { StatusBadge } from "../StatusBadge";
import type { QueueItem } from "@/lib/media/queue.server";

vi.mock("@/lib/media/requests.actions", () => ({
    requestMovie: vi.fn(),
    cancelRequest: vi.fn(),
    unfollowRequest: vi.fn(),
    keepRequest: vi.fn(),
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
    removal: null,
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
                    item(3, "approved", "Group B · 1080p · 20 GB"),
                ]}
            />
        </QueryClientProvider>
    );

    expect(screen.getByText("Awaiting admin approval")).toBeInTheDocument();
    expect(screen.queryByText("Suggested: Group · 2160p · 50 GB")).toBeNull();
    expect(screen.getByText("Waiting for digital release, 12 Nov")).toBeInTheDocument();
    // Once the admin has chosen, members just see it being added.
    expect(screen.getByText("Being added")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).toBeNull();
});

it("keeps the precise status for the admin", () => {
    render(<StatusBadge status="approved" admin />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
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

it("tells when a temporary title leaves, and offers keeping it or a +1", () => {
    const removal = { days: 30, at: "2026-11-16T10:32:00Z" };
    render(
        <QueryClientProvider client={new QueryClient()}>
            <QueueList
                heading="Queue"
                items={[
                    { ...item(1, "wanted", ""), removal: { days: 30, at: null } },
                    { ...item(2, "available", ""), removal },
                    { ...item(3, "available", ""), removal, role: null },
                    { ...item(4, "available", ""), removal: { days: 30, at: null }, role: null },
                    { ...item(5, "available", ""), removal, role: null, followerCount: 1 },
                    { ...item(6, "available", ""), removal: { days: 30, at: null } },
                ]}
            />
        </QueryClientProvider>
    );

    const row = (title: string) => screen.getByText(title).closest("li") as HTMLElement;
    expect(row("Movie 1")).toHaveTextContent(
        "Leaves the library 30 days after it's added, unless someone +1s it"
    );
    expect(
        within(row("Movie 1")).getByRole("button", { name: "Keep Movie 1 in the library" })
    ).toBeInTheDocument();
    expect(
        within(row("Movie 1")).getByRole("button", { name: "Cancel your request for Movie 1" })
    ).toBeInTheDocument();
    expect(row("Movie 2")).toHaveTextContent("Leaves the library 16 Nov, unless someone +1s it");
    expect(within(row("Movie 2")).getByRole("button")).toHaveAccessibleName(
        "Keep Movie 2 in the library"
    );
    expect(within(row("Movie 3")).getByRole("button")).toHaveAccessibleName("+1 Movie 3");
    // Not scheduled: the worker didn't add it, so it stays. A +1 already keeps the last one.
    expect(within(row("Movie 4")).queryByRole("button")).toBeNull();
    expect(within(row("Movie 6")).queryByRole("button")).toBeNull();
    expect(row("Movie 4")).not.toHaveTextContent("Leaves the library");
    expect(row("Movie 5")).not.toHaveTextContent("Leaves the library");
    expect(within(row("Movie 5")).getByRole("button")).toHaveAccessibleName("+1 Movie 5");
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

it("marks the rows you requested or +1'd", () => {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <QueueList
                heading="Queue"
                items={[
                    item(1, "wanted", ""),
                    {
                        ...item(2, "wanted", ""),
                        requester: { name: "Other", isYou: false },
                        role: "follower",
                    },
                    {
                        ...item(3, "wanted", ""),
                        requester: { name: "Other", isYou: false },
                        role: null,
                    },
                ]}
            />
        </QueryClientProvider>
    );
    const row = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

    expect(row("Movie 1")).toHaveClass("bg-primary/5");
    expect(row("Movie 2")).toHaveClass("bg-primary/5");
    expect(row("Movie 2")).toHaveTextContent("You gave it +1");
    expect(row("Movie 3")).not.toHaveClass("bg-primary/5");
    expect(row("Movie 3")).not.toHaveTextContent("You gave it +1");
});
