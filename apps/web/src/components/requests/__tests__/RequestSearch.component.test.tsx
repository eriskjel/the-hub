import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { setIntl } from "@/tests/testUtils";
import enMessages from "@/messages/en.json";
import RequestSearch from "../RequestSearch";
import { requestMovie, unfollowRequest } from "@/lib/media/requests.actions";
import type { SearchResult } from "@/lib/media/request";

vi.mock("@/lib/media/requests.actions", () => ({
    requestMovie: vi.fn(),
    cancelRequest: vi.fn(),
    unfollowRequest: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const result = (tmdbId: number, request: SearchResult["request"] = null): SearchResult => ({
    tmdbId,
    title: `Movie ${tmdbId}`,
    year: "2014",
    posterPath: null,
    request,
});

const RESULTS: SearchResult[] = [
    result(1),
    result(2, { id: 12, status: "wanted", role: "requester" }),
    result(3, { id: 13, status: "searching", role: "follower" }),
    result(4, { id: 14, status: "approved", role: null }),
    result(5, { id: 15, status: "available", role: null }),
    result(6, { id: 16, status: "searching", role: "requester" }),
];

let fetchMock: ReturnType<typeof vi.fn>;

function renderSearch() {
    setIntl({ locale: "en", messages: enMessages });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <RequestSearch />
        </QueryClientProvider>
    );
}

function type(text: string) {
    fireEvent.change(screen.getByLabelText("Search for a movie"), { target: { value: text } });
}

const row = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn(async () => Response.json({ results: RESULTS }));
    vi.stubGlobal("fetch", fetchMock);
});

describe("RequestSearch", () => {
    it("waits for two characters before searching", async () => {
        renderSearch();
        type(" i ");

        await new Promise((r) => setTimeout(r, 400));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("searches once typing pauses, in the page's language", async () => {
        renderSearch();
        type("int");
        type("inter ");

        await screen.findByText("Movie 1");
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0][0]).toBe("/api/media/search?q=inter&locale=en");
    });

    it("shows the top five results, and the rest on request", async () => {
        renderSearch();
        type("inter");
        await screen.findByText("Movie 1");

        expect(screen.getAllByRole("listitem")).toHaveLength(5);
        expect(screen.queryByText("Movie 6")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));
        expect(screen.getAllByRole("listitem")).toHaveLength(6);
        expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
    });

    it("offers what fits each title", async () => {
        renderSearch();
        type("inter");
        await screen.findByText("Movie 1");
        fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));

        const button = (title: string) => within(row(title)).queryByRole("button");
        expect(button("Movie 1")).toHaveAccessibleName("Request Movie 1");
        expect(button("Movie 2")).toHaveAccessibleName("Cancel your request for Movie 2");
        expect(button("Movie 3")).toHaveAccessibleName("Remove your +1 for Movie 3");
        expect(button("Movie 4")).toHaveAccessibleName("+1 Movie 4");
        // Nothing to do: already available, or your own request is being worked on.
        expect(button("Movie 5")).toBeNull();
        expect(within(row("Movie 5")).getByText("Available")).toBeInTheDocument();
        expect(button("Movie 6")).toBeNull();
    });

    it("requests a title by its TMDB id, then clears the search for the next one", async () => {
        vi.mocked(requestMovie).mockResolvedValueOnce({ ok: true, outcome: "requested" });
        renderSearch();
        type("inter");
        await screen.findByText("Movie 1");

        fireEvent.click(within(row("Movie 1")).getByRole("button"));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Requested."));
        expect(requestMovie).toHaveBeenCalledWith(1);
        await waitFor(() => expect(screen.queryByRole("listitem")).toBeNull());
        const input = screen.getByLabelText("Search for a movie");
        expect(input).toHaveValue("");
        expect(input).toHaveFocus();
    });

    it("keeps the results, refreshed, when nothing changed", async () => {
        vi.mocked(requestMovie).mockResolvedValueOnce({ ok: true, outcome: "already_requested" });
        renderSearch();
        type("inter");
        await screen.findByText("Movie 1");

        fireEvent.click(within(row("Movie 1")).getByRole("button"));

        await waitFor(() =>
            expect(toast.info).toHaveBeenCalledWith("You've already requested this.")
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(screen.getByText("Movie 1")).toBeInTheDocument();
        expect(screen.getByLabelText("Search for a movie")).toHaveValue("inter");
    });

    it("sends the request id to take back a +1", async () => {
        vi.mocked(unfollowRequest).mockResolvedValueOnce({ ok: true, outcome: "unfollowed" });
        renderSearch();
        type("inter");
        await screen.findByText("Movie 3");

        fireEvent.click(within(row("Movie 3")).getByRole("button"));

        await waitFor(() => expect(unfollowRequest).toHaveBeenCalledWith(13));
    });

    it("explains a refusal", async () => {
        vi.mocked(requestMovie).mockResolvedValueOnce({ ok: false, error: "quota_exceeded" });
        renderSearch();
        type("inter");
        await screen.findByText("Movie 1");

        fireEvent.click(within(row("Movie 1")).getByRole("button"));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "You've used this week's requests. You can still +1 others."
            )
        );
    });

    it("says when search isn't working", async () => {
        fetchMock.mockResolvedValueOnce(
            Response.json({ error: "search_unavailable" }, { status: 502 })
        );
        renderSearch();
        type("inter");

        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent(
                "Search isn't working right now. Try again later."
            )
        );
    });
});
