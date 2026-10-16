import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getQueue } from "@/lib/media/queue.server";
import { getWorkerStatus } from "@/lib/media/worker.server";
import { isOpenStatus } from "@/lib/media/request";
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
    return (
        <AdminPage title={t("title")} description={t("intro")}>
            <QueueRefresh />
            <WorkerStatusCard worker={worker} locale={locale} />
            <AdminQueueList
                items={queue.filter((item) => isOpenStatus(item.status))}
                heading={t("open")}
                locale={locale}
            />
            <AdminQueueList
                items={queue.filter((item) => item.status === "available")}
                heading={t("available")}
                locale={locale}
            />
            <AdminQueueList
                items={queue.filter((item) =>
                    ["failed", "declined", "cancelled"].includes(item.status)
                )}
                heading={t("closed")}
                locale={locale}
            />
        </AdminPage>
    );
}
