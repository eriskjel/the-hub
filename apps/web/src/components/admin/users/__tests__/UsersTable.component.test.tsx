import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import type { AdminUsersQuery, AdminUsersResult } from "@/lib/admin/users";
import { queryKeys } from "@/lib/queryKeys";
import UsersTable from "../UsersTable";

vi.mock("next/navigation", async () => {
    const { useSyncExternalStore } = await import("react");
    return {
        useSearchParams: () =>
            new URLSearchParams(
                useSyncExternalStore(
                    (listener) => {
                        window.addEventListener("popstate", listener);
                        return () => window.removeEventListener("popstate", listener);
                    },
                    () => window.location.search
                )
            ),
    };
});
vi.mock("@/i18n/navigation", () => ({
    Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

const initial: AdminUsersResult = {
    viewerId: "admin",
    page: 1,
    perPage: 10,
    total: 21,
    q: "",
    users: [
        {
            id: "alice",
            name: "Alice",
            email: "alice@example.test",
            role: "user",
            hasAccess: false,
            libraryAccount: null,
            lastSignIn: null,
        },
    ],
};
const second: AdminUsersResult = {
    ...initial,
    page: 2,
    users: [{ ...initial.users[0], id: "bob", name: "Bob" }],
};
let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
function table(data = initial, query: AdminUsersQuery = data, updatedAt = Date.now()) {
    const serverClient = new QueryClient();
    serverClient.setQueryData(
        queryKeys.adminUsers(data.viewerId, query.page, query.perPage, query.q),
        data,
        { updatedAt }
    );
    return (
        <QueryClientProvider client={client}>
            <HydrationBoundary state={dehydrate(serverClient)}>
                <UsersTable key={data.viewerId} viewerId={data.viewerId} />
            </HydrationBoundary>
        </QueryClientProvider>
    );
}
function mount(data = initial) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    return render(table(data));
}
const response = (data: AdminUsersResult) => ({ ok: true, json: async () => data });

beforeEach(() => {
    setIntl({ locale: "en", messages: en });
    window.history.replaceState(null, "", "/en/admin/users");
    // Next patches native history to notify useSearchParams. Model that integration here.
    const push = window.history.pushState.bind(window.history);
    const replace = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
        push(...args);
        window.dispatchEvent(new PopStateEvent("popstate"));
    });
    vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
        replace(...args);
        window.dispatchEvent(new PopStateEvent("popstate"));
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    cleanup();
    client?.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("keeps the same table, rows and pagination while the next page is pending", async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    mount();
    expect(fetchMock).not.toHaveBeenCalled();
    const table = screen.getByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("table")).toBe(table);
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByText("Updating users…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await act(async () => {
        finish(response(second));
    });
    expect(await screen.findByRole("link", { name: "Bob" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBe(table);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

it("keeps previous results and offers retry when a page request fails", async () => {
    fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce(response(second));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("last loaded users");
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    const historyLength = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(window.history.length).toBe(historyLength);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Bob" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

it("does not keep sensitive rows visible after an authorization failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
});

it("keeps rows hidden after a denial through a new search and a failed retry", async () => {
    fetchMock
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce(response({ ...initial, q: "Alice", total: 1 }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alice" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled());
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer have access");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
});

it("does not restore a cached page on history navigation after a denial", async () => {
    fetchMock.mockResolvedValueOnce(response(second)).mockResolvedValueOnce({
        ok: false,
        status: 403,
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Bob" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
    await act(async () => {
        window.history.back();
    });
    await screen.findByText(/^Page 1 of/);
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer have access");
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("disables paging while the shown rows are from an earlier search", async () => {
    window.history.replaceState(null, "", "/en/admin/users?page=2&per=10");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    mount(second);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bo" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("last loaded users");
    expect(screen.getByRole("link", { name: "Bob" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});

it("searches all users once typing pauses, resets pagination, and keeps the search in detail links", async () => {
    window.history.replaceState(null, "", "/en/admin/users?page=2&per=10");
    fetchMock.mockResolvedValue(response({ ...initial, q: "Alice", total: 1 }));
    mount(second);
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    for (const value of ["A", "Al", " Alice "]) {
        fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
    }
    const link = await screen.findByRole("link", { name: "Alice" });
    expect(link).toHaveAttribute("href", "/admin/users/alice?page=1&per=10&q=Alice");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/users?page=1&per=10&q=Alice");
    // The URL gets the trimmed search; the field keeps what was typed so far.
    expect(screen.getByRole("searchbox")).toHaveValue(" Alice ");
});

it("restores cached results and search input on browser history navigation", async () => {
    fetchMock
        .mockResolvedValueOnce(response(second))
        .mockResolvedValueOnce(response({ ...second, page: 1, q: "Bob", total: 1 }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Bob" });
    // The search replaces the page-2 entry, so Back returns to the unfiltered first page.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bob" } });
    await waitFor(() => expect(window.location.search).toBe("?page=1&per=10&q=Bob"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {
        window.history.back();
    });
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("drops an unsent search when Back returns to another page", async () => {
    fetchMock.mockResolvedValueOnce(response(second));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Bob" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bo" } });
    await act(async () => {
        window.history.back();
    });
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
    // Past the debounce, the restored entry is still the unfiltered first page.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("clears a search right away and shows the cached full list", async () => {
    fetchMock.mockResolvedValue(response({ ...second, page: 1, q: "Bob", total: 1 }));
    mount();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bob" } });
    await screen.findByRole("link", { name: "Bob" });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(await screen.findByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(window.location.search).toBe("?page=1&per=10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("resets the page when changing page size and displays an empty result", async () => {
    fetchMock.mockResolvedValue(response({ ...initial, perPage: 20, users: [], total: 0 }));
    mount();
    fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "20" } });
    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/users?page=1&per=20");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});

it("canonicalizes a page beyond the end without fetching it again", async () => {
    window.history.replaceState(null, "", "/en/admin/users?page=99");
    client = new QueryClient();
    render(table(second, { ...second, page: 99 }));
    await waitFor(() => expect(window.location.search).toBe("?page=2&per=10"));
    expect(screen.getByRole("link", { name: "Bob" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
});

it("keeps a denial across remounts and server hydration until an API request succeeds", async () => {
    fetchMock
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce(response(initial));
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
    view.unmount();

    // Next can restore an earlier server payload while the root QueryClient survives.
    render(table(initial));
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled());
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer have access");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
});

it("hydrates newer server results into an already cached page without another fetch", async () => {
    const view = mount();
    const fresh = { ...initial, users: [{ ...initial.users[0], name: "Alice Updated" }] };
    view.rerender(table(fresh, fresh, Date.now() + 1000));
    expect(await screen.findByRole("link", { name: "Alice Updated" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
});

it("uses the newer server page when an old bookmark has a cached clamped result", async () => {
    const now = Date.now();
    window.history.replaceState(null, "", "/en/admin/users?page=99&per=10");
    client = new QueryClient();
    client.setQueryData(queryKeys.adminUsers("admin", 99, 10, ""), second, {
        updatedAt: now - 1000,
    });
    const fresh = { ...initial, page: 3 };
    render(table(fresh, { ...fresh, page: 99 }, now));
    await waitFor(() => expect(window.location.search).toBe("?page=3&per=10"));
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
});

it("does not overwrite newer client results when an old server payload is restored", async () => {
    const snapshotTime = Date.now();
    const view = mount();
    const fresh = { ...initial, users: [{ ...initial.users[0], name: "Alice Updated" }] };
    act(() => {
        client.setQueryData(queryKeys.adminUsers("admin", 1, 10, ""), fresh, {
            updatedAt: snapshotTime + 1000,
        });
    });
    view.rerender(table(initial, initial, snapshotTime));
    expect(await screen.findByRole("link", { name: "Alice Updated" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
});

it("waits for a stale bookmark to refetch before correcting its page", async () => {
    window.history.replaceState(null, "", "/en/admin/users?page=99&per=10");
    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    client = new QueryClient();
    render(table(second, { ...second, page: 99 }, Date.now() - 60_000));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(window.location.search).toBe("?page=99&per=10");
    await act(async () => {
        finish(response({ ...initial, page: 3 }));
    });
    await waitFor(() => expect(window.location.search).toBe("?page=3&per=10"));
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
});

it("does not reuse one viewer's denial for a different authorized viewer", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByRole("alert");
    view.rerender(table({ ...initial, viewerId: "another-admin" }));
    expect(await screen.findByRole("link", { name: "Alice" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("cancels an obsolete page fetch when a newer search starts", async () => {
    let pageSignal: AbortSignal | undefined;
    fetchMock
        .mockImplementationOnce((_url, { signal }) => {
            pageSignal = signal;
            return new Promise(() => {});
        })
        .mockResolvedValueOnce(response({ ...initial, q: "Alice", total: 1 }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(pageSignal).toBeDefined());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alice" } });
    await waitFor(() => expect(pageSignal?.aborted).toBe(true));
    await waitFor(() =>
        expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
            "href",
            "/admin/users/alice?page=1&per=10&q=Alice"
        )
    );
});
