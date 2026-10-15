"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Search, UsersRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { USER_PAGE_SIZES, type AdminUsersQuery, type AdminUsersResult } from "@/lib/admin/users";
import { UsersSkeletonRows } from "./UsersTableSkeleton";
import { useAdminUsers } from "./useAdminUsers";

export default function UsersTable({
    initialData,
    initialQuery,
}: {
    initialData: AdminUsersResult;
    initialQuery: AdminUsersQuery;
}) {
    const t = useTranslations("admin.users");
    const locale = useLocale();
    const {
        query,
        result,
        shown,
        forbidden,
        fetching,
        waiting,
        totalPages,
        returnQuery,
        updateUrl,
        searchText,
        setSearchText,
        setComposing,
        clearSearch,
        submitSearch,
    } = useAdminUsers(initialData, initialQuery);

    return (
        <section
            className="border-border bg-surface overflow-hidden rounded-2xl border"
            aria-label={t("title")}
        >
            <div className="border-border flex flex-wrap items-end justify-between gap-4 border-b p-4 sm:p-5">
                <form
                    role="search"
                    className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:flex-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitSearch();
                    }}
                >
                    <div className="min-w-0 flex-1 sm:max-w-md">
                        <label
                            htmlFor="users-search"
                            className="text-foreground mb-2 block text-sm font-medium"
                        >
                            {t("search.label")}
                        </label>
                        <div className="relative">
                            <Search
                                aria-hidden="true"
                                className="text-muted pointer-events-none absolute top-3 left-3 h-4 w-4"
                            />
                            <input
                                id="users-search"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                onCompositionStart={() => setComposing(true)}
                                onCompositionEnd={() => setComposing(false)}
                                placeholder={t("search.placeholder")}
                                className="border-border bg-background text-foreground focus-visible:ring-primary h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
                            />
                        </div>
                    </div>
                    {searchText && (
                        <Button type="button" className="h-10" onClick={clearSearch}>
                            {t("search.clear")}
                        </Button>
                    )}
                </form>
                <Button
                    type="button"
                    className="h-10"
                    disabled={fetching}
                    onClick={() => void result.refetch()}
                >
                    <RefreshCw
                        aria-hidden="true"
                        className={`h-4 w-4 ${fetching ? "motion-safe:animate-spin" : ""}`}
                    />
                    {t("refresh")}
                </Button>
            </div>
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="text-muted">
                    {shown
                        ? t("pagination.total_users_count", { count: shown.total })
                        : t("loading")}
                </span>
                <span role="status" className="text-muted">
                    {fetching ? t("updating") : result.isPaused ? t("offline") : ""}
                </span>
            </div>
            {result.isError && (
                <div
                    role="alert"
                    className="border-error/20 bg-error/5 text-error mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                    <span>{t(forbidden ? "forbidden" : "loadError")}</span>
                    <Button type="button" disabled={fetching} onClick={() => void result.refetch()}>
                        {t("retry")}
                    </Button>
                </div>
            )}
            <div className="overflow-x-auto" aria-busy={fetching}>
                <table className="w-full text-left text-sm">
                    <caption className="sr-only">{t("title")}</caption>
                    <thead className="border-border bg-surface-subtle/50 text-muted border-y text-xs">
                        <tr>
                            <th scope="col" className="px-5 py-3 font-medium">
                                {t("columns.name")}
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                                {t("columns.role")}
                            </th>
                            <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">
                                {t("columns.requests")}
                            </th>
                            <th scope="col" className="hidden px-5 py-3 font-medium lg:table-cell">
                                {t("columns.lastLogin")}
                            </th>
                            <th scope="col" className="px-5 py-3">
                                <span className="sr-only">{t("columns.actions")}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        className={waiting ? "opacity-60 transition-opacity" : "transition-opacity"}
                    >
                        {!shown ? (
                            forbidden ? null : (
                                <UsersSkeletonRows rows={query.perPage} />
                            )
                        ) : (
                            shown.users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="border-border hover:bg-surface-subtle/50 border-b last:border-b-0"
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                aria-hidden="true"
                                                className="bg-primary/10 text-primary hidden h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold sm:flex"
                                            >
                                                {user.name.slice(0, 1).toUpperCase()}
                                            </span>
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/admin/users/${user.id}?${returnQuery}`}
                                                    className="text-foreground focus-visible:ring-primary rounded font-medium hover:underline focus-visible:ring-2"
                                                >
                                                    {user.name}
                                                </Link>
                                                <p
                                                    className="text-muted mt-0.5 max-w-72 truncate text-xs"
                                                    title={user.email}
                                                >
                                                    {user.email || t("noEmail")}
                                                </p>
                                                <p className="text-muted mt-1 text-xs sm:hidden">
                                                    {user.hasAccess
                                                        ? t("access.active")
                                                        : t("access.none")}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <RoleBadge role={user.role} />
                                    </td>
                                    <td className="hidden px-5 py-4 sm:table-cell">
                                        <span
                                            className={
                                                user.hasAccess ? "text-foreground" : "text-muted"
                                            }
                                        >
                                            {user.hasAccess ? t("access.active") : t("access.none")}
                                        </span>
                                        {user.libraryAccount && (
                                            <p
                                                className="text-muted mt-1 max-w-40 truncate font-mono text-xs"
                                                title={user.libraryAccount}
                                            >
                                                {user.libraryAccount}
                                            </p>
                                        )}
                                    </td>
                                    <td className="text-muted hidden px-5 py-4 whitespace-nowrap lg:table-cell">
                                        {user.lastSignIn
                                            ? new Intl.DateTimeFormat(
                                                  locale === "no" ? "nb-NO" : locale,
                                                  { dateStyle: "medium", timeZone: "Europe/Oslo" }
                                              ).format(new Date(user.lastSignIn))
                                            : t("never")}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <Link
                                            href={`/admin/users/${user.id}?${returnQuery}`}
                                            aria-label={t("viewUser", { name: user.name })}
                                            className="text-muted hover:text-primary focus-visible:ring-primary inline-flex items-center gap-2 rounded-lg p-2 focus-visible:ring-2"
                                        >
                                            <span className="hidden sm:inline">{t("view")}</span>
                                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                        {shown?.users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-5 py-16 text-center">
                                    <UsersRound
                                        aria-hidden="true"
                                        className="text-muted mx-auto mb-3 h-8 w-8"
                                    />
                                    <p className="text-foreground font-medium">{t("empty")}</p>
                                    <p className="text-muted mt-2">
                                        {t(query.q ? "emptySearch" : "emptyDirectory")}
                                    </p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <footer className="border-border flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
                <div className="text-muted flex items-center gap-2 text-xs">
                    <label htmlFor="users-per-page">{t("pagination.items_per_page")}</label>
                    <select
                        id="users-per-page"
                        value={query.perPage}
                        disabled={fetching}
                        onChange={(event) =>
                            updateUrl({ ...query, perPage: Number(event.target.value), page: 1 })
                        }
                        className="border-border bg-background text-foreground focus-visible:ring-primary rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 disabled:opacity-50"
                    >
                        {USER_PAGE_SIZES.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>
                <nav aria-label={t("pagination.label")} className="flex items-center gap-3">
                    <span className="text-muted text-xs" role="status">
                        {t("pagination.page_of", {
                            page: shown?.page ?? query.page,
                            total: totalPages,
                        })}
                    </span>
                    <Button
                        type="button"
                        aria-label={t("pagination.prev")}
                        disabled={fetching || !shown || shown.page <= 1}
                        onClick={() =>
                            updateUrl({ ...query, page: Math.max(1, (shown?.page ?? 1) - 1) })
                        }
                    >
                        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("pagination.prev")}</span>
                    </Button>
                    <Button
                        type="button"
                        aria-label={t("pagination.next")}
                        disabled={fetching || !shown || shown.page >= totalPages}
                        onClick={() => updateUrl({ ...query, page: (shown?.page ?? 1) + 1 })}
                    >
                        <span className="hidden sm:inline">{t("pagination.next")}</span>
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Button>
                </nav>
            </footer>
        </section>
    );
}
