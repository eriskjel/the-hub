import { getWorkerStatus } from "@/lib/media/worker.server";
import { memberProcessingMessage } from "@/lib/media/processing";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/server";
import { countRecentRequests, getOwnMembership, queueReader } from "@/lib/media/membership.server";
import { countWaitingForAdmin, getQueue } from "@/lib/media/queue.server";
import { isOpenStatus } from "@/lib/media/request";
import RequestSearch from "@/components/requests/RequestSearch";
import { QueueRefresh } from "@/components/requests/QueueRefresh";
import { QueueList } from "@/components/requests/QueueList";
import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RequestsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ mine?: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: "requests" });

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale}/login`);

    const membership = await getOwnMembership(user);
    if (!membership?.active) {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <h1 className="text-foreground mb-2 text-2xl font-semibold">{t("pageTitle")}</h1>
                <p className="text-muted">
                    {membership?.revokedAt ? t("noAccess.revoked") : t("noAccess.none")}
                </p>
            </div>
        );
    }

    const mine = (await searchParams).mine === "1";
    const reader = queueReader(membership, supabase);
    // Admins decide on the admin page, where the proposals are; this only points there.
    const [queue, used, worker, waitingForAdmin] = await Promise.all([
        getQueue(reader, user.id, locale),
        countRecentRequests(reader, user.id),
        getWorkerStatus(reader),
        membership.viaAdmin ? countWaitingForAdmin(reader) : 0,
    ]);
    const shown = mine ? queue.filter((item) => item.role !== null) : queue;

    // The queue in the order it's worked: oldest first. Everything else, newest first.
    const open = shown.filter((item) => isOpenStatus(item.status));
    const available = shown.filter((item) => item.status === "available");
    const closed = shown.filter((item) => item.status === "failed" || item.status === "declined");

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <QueueRefresh />
            <header className="space-y-1">
                <h1 className="text-foreground text-2xl font-semibold">{t("pageTitle")}</h1>
                <p className="text-muted text-sm">{t("intro")}</p>
                <p role="status" className="text-muted text-sm">
                    {t(memberProcessingMessage(worker))}
                </p>
                <p className="text-muted text-sm">
                    {membership.weeklyQuota === null
                        ? t("quotaAdmin")
                        : membership.weeklyQuota === 0
                          ? t("quotaNone")
                          : t("quota", {
                                used: String(Math.min(used, membership.weeklyQuota)),
                                quota: String(membership.weeklyQuota),
                            })}
                </p>
            </header>

            {waitingForAdmin > 0 && (
                <Link
                    href="/admin/requests"
                    locale={locale}
                    className="border-primary/30 bg-primary/5 hover:bg-primary/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-4 py-3 text-sm transition-colors"
                >
                    <span className="text-foreground font-medium">
                        {t("adminWaiting", { count: waitingForAdmin })}
                    </span>
                    <span className="text-primary inline-flex items-center gap-1 font-medium">
                        {t("adminOpen")}
                        <ArrowRight aria-hidden className="h-4 w-4" />
                    </span>
                </Link>
            )}

            <div className="border-border bg-surface rounded-lg border p-4">
                <RequestSearch />
            </div>

            <nav aria-label={t("queue.filter")} className="flex gap-2 text-sm">
                <FilterLink active={!mine} href="/requests">
                    {t("queue.all")}
                </FilterLink>
                <FilterLink active={mine} href={{ pathname: "/requests", query: { mine: "1" } }}>
                    {t("queue.mine")}
                </FilterLink>
            </nav>

            <QueueList heading={t("queue.title")} items={open} empty={t("queue.empty")} />
            <QueueList heading={t("queue.done")} items={available} />
            <QueueList heading={t("queue.closed")} items={closed} />

            <footer className="text-muted-subtle border-border border-t pt-4 text-xs">
                {t("attribution")}{" "}
                <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                >
                    themoviedb.org
                </a>
            </footer>
        </div>
    );
}

function FilterLink({
    active,
    href,
    children,
}: {
    active: boolean;
    href: "/requests" | { pathname: "/requests"; query: { mine: string } };
    children: string;
}) {
    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                active ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-light"
            )}
        >
            {children}
        </Link>
    );
}
