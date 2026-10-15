import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { setIntl } from "@/tests/testUtils";
import en from "@/messages/en.json";

const { listUsersAdmin, getMediaMembers } = vi.hoisted(() => ({
    listUsersAdmin: vi.fn(),
    getMediaMembers: vi.fn(),
}));
vi.mock("@/lib/admin/users.server", () => ({ listUsersAdmin }));
vi.mock("@/lib/admin/mediaMember.server", () => ({ getMediaMembers }));
vi.mock("next-intl/server", () => ({
    getTranslations: async () => (key: string) =>
        key
            .split(".")
            .reduce<unknown>(
                (value, part) => (value as Record<string, unknown>)[part],
                en.admin.users
            ) as string,
}));
vi.mock("next/form", () => ({
    default: (props: ComponentProps<"form">) => <form {...props} method="get" />,
}));
vi.mock("@/i18n/navigation", () => ({
    Link: ({
        href,
        children,
    }: {
        href: { pathname: string; query: Record<string, string> };
        children: React.ReactNode;
    }) => <a href={`${href.pathname}?${new URLSearchParams(href.query)}`}>{children}</a>,
}));
vi.mock("@/components/admin/users/UsersTable", () => ({
    default: ({ page, total }: { page: number; total: number }) => (
        <p>{`Page ${page}, total ${total}`}</p>
    ),
}));
import Page from "@/app/[locale]/(protected)/(admin)/admin/users/page";

beforeEach(() => {
    vi.clearAllMocks();
    setIntl({ locale: "en", messages: en });
    listUsersAdmin.mockResolvedValue({ users: [], total: 0, page: 1, perPage: 5 });
    getMediaMembers.mockResolvedValue({});
});

it("passes the query to global search and renders its matching pagination", async () => {
    const view = await Page({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: " Alice ", page: "3", per: "5" }),
    });
    const { container } = render(view);
    expect(listUsersAdmin).toHaveBeenCalledWith({ q: "Alice", page: 3, perPage: 5 });
    expect(screen.getByLabelText("Search users")).toHaveValue("Alice");
    expect(screen.getByText("Page 1, total 0")).toBeInTheDocument();
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/en/admin/users");
    const values = new FormData(form);
    expect(values.get("per")).toBe("5");
    expect(values.has("page")).toBe(false);
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
        "href",
        "/admin/users?per=5"
    );
});

it("uses the first value of repeated query parameters", async () => {
    const view = await Page({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: ["alice", "bob"], page: ["2", "9"], per: ["10", "20"] }),
    });
    render(view);
    expect(listUsersAdmin).toHaveBeenCalledWith({ q: "alice", page: 2, perPage: 10 });
    expect(screen.getByLabelText("Search users")).toHaveValue("alice");
});

it("says no users were found only when nothing matches", async () => {
    const { unmount } = render(
        await Page({
            params: Promise.resolve({ locale: "en" }),
            searchParams: Promise.resolve({ q: "missing" }),
        })
    );
    expect(screen.getByText(en.admin.users.empty)).toBeInTheDocument();
    unmount();

    // A page past the end is empty, but users exist.
    listUsersAdmin.mockResolvedValue({ users: [], total: 105, page: 99, perPage: 5 });
    render(
        await Page({
            params: Promise.resolve({ locale: "en" }),
            searchParams: Promise.resolve({ page: "99" }),
        })
    );
    expect(screen.queryByText(en.admin.users.empty)).toBeNull();
});
