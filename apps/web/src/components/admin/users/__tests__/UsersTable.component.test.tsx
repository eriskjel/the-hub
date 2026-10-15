import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";
import type { AdminUsersResult } from "@/lib/admin/users";
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
function mount(data = initial) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    return render(
        <QueryClientProvider client={client}>
            <UsersTable initialData={data} initialQuery={data} />
        </QueryClientProvider>
    );
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
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Bob" })).toBeInTheDocument();
});

it("does not keep sensitive rows visible after an authorization failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
});

it("searches all users, resets pagination, and preserves the search in detail links", async () => {
    window.history.replaceState(null, "", "/en/admin/users?page=2&per=10");
    fetchMock.mockResolvedValue(response({ ...initial, q: "Alice", total: 1 }));
    mount(second);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " Alice " } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const link = await screen.findByRole("link", { name: "Alice" });
    expect(link).toHaveAttribute("href", "/admin/users/alice?page=1&per=10&q=Alice");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/users?page=1&per=10&q=Alice");
});

it("restores cached results and search input on browser history navigation", async () => {
    fetchMock.mockResolvedValue(response({ ...second, page: 1, q: "Bob", total: 1 }));
    mount();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("link", { name: "Bob" });
    await act(async () => {
        window.history.back();
    });
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
    expect(screen.getByRole("link", { name: "Alice" })).toBeInTheDocument();
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
    render(
        <QueryClientProvider client={client}>
            <UsersTable initialData={second} initialQuery={{ ...second, page: 99 }} />
        </QueryClientProvider>
    );
    await waitFor(() => expect(window.location.search).toBe("?page=2&per=10"));
    expect(screen.getByRole("link", { name: "Bob" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(pageSignal?.aborted).toBe(true));
    await waitFor(() =>
        expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
            "href",
            "/admin/users/alice?page=1&per=10&q=Alice"
        )
    );
});
