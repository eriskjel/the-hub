import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getQueue, getRequestOptions } from "@/lib/media/queue.server";
import { getWorkerStatus } from "@/lib/media/worker.server";
import { isOpenStatus } from "@/lib/media/request";
import { NEEDS_ADMIN_STATUSES } from "@/lib/media/admin";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";
import { WorkerStatusCard } from "@/components/admin/requests/WorkerStatusCard";
import { AdminQueueList } from "@/components/admin/requests/AdminQueueList";
import { QueueRefresh } from "@/components/requests/QueueRefresh";
import { AdminPage } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    setRequestLocale(locale);
    const { user } = await requireAdmin(locale);
    const client = createAdminClient();
    const [queue, worker, t] = await Promise.all([
        getQueue(client, user.id, locale, { admin: true }),
        getWorkerStatus(client),
        getTranslations({ locale, namespace: "admin.requests" }),
    ]);
    // Sorted by who acts next: the admin, the worker, or no one.
    const needsYou = queue.filter((item) => NEEDS_ADMIN_STATUSES.includes(item.status));
    const inProgress = queue.filter(
        (item) => isOpenStatus(item.status) && !NEEDS_ADMIN_STATUSES.includes(item.status)
    );
    const options = await getRequestOptions(
        client,
        needsYou.map((item) => item.id)
    );
    return (
        <AdminPage title={t("title")} description={t("intro")}>
            <QueueRefresh intervalMs={15_000} />
            <WorkerStatusCard worker={worker} locale={locale} />
            <AdminQueueList
                items={needsYou}
                options={options}
                heading={t("needsYou")}
                empty={t("needsYouEmpty")}
                locale={locale}
                highlight
            />
            <AdminQueueList
                items={inProgress}
                heading={t("inProgress")}
                empty={t("empty")}
                locale={locale}
            />
            <div className="space-y-3">
                <AdminQueueList
                    items={queue.filter((item) => item.status === "available")}
                    heading={t("available")}
                    empty={t("empty")}
                    locale={locale}
                    collapsed
                />
                <AdminQueueList
                    items={queue.filter((item) => ["declined", "cancelled"].includes(item.status))}
                    heading={t("closed")}
                    empty={t("empty")}
                    locale={locale}
                    collapsed
                />
            </div>
        </AdminPage>
    );
}
