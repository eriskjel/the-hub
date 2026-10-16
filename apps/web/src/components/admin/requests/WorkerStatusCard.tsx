import { getTranslations } from "next-intl/server";
import { workerState, type WorkerStatus } from "@/lib/media/admin";
import { ProcessingToggle } from "@/components/admin/requests/QueueControls";
import type { Locale } from "@/i18n/routing";

export async function WorkerStatusCard({
    worker,
    locale,
}: {
    worker: WorkerStatus;
    locale: Locale;
}) {
    const t = await getTranslations({ locale, namespace: "admin.requests.worker" });
    const status = workerState(worker);
    const lastRun = worker.lastRunAt
        ? new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Oslo",
          }).format(new Date(worker.lastRunAt))
        : t("never");
    return (
        <section
            className="border-border bg-surface space-y-5 rounded-2xl border p-5 sm:p-6"
            aria-labelledby="worker-heading"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="worker-heading" className="font-semibold">
                    {t("title")}
                </h2>
                <ProcessingToggle paused={worker.paused} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                    <dt className="text-muted">{t("state")}</dt>
                    <dd>{t(status)}</dd>
                </div>
                <div>
                    <dt className="text-muted">{t("mode")}</dt>
                    <dd>{t(`modes.${worker.mode ?? "unknown"}`)}</dd>
                </div>
                <div>
                    <dt className="text-muted">{t("lastRun")}</dt>
                    <dd>{lastRun}</dd>
                </div>
            </dl>
            {status === "stale" && <p className="text-muted text-sm">{t("staleHelp")}</p>}
            {worker.detail && <p className="text-muted text-sm">{worker.detail}</p>}
        </section>
    );
}
