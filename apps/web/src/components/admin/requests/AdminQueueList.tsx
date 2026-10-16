import { getTranslations } from "next-intl/server";
import { Poster } from "@/components/requests/Poster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { QueueControls } from "@/components/admin/requests/QueueControls";
import type { QueueItem } from "@/lib/media/queue.server";
import type { Locale } from "@/i18n/routing";

export async function AdminQueueList({
    items,
    heading,
    locale,
}: {
    items: QueueItem[];
    heading: string;
    locale: Locale;
}) {
    const t = await getTranslations({ locale, namespace: "requests.queue" });
    return (
        <section className="border-border bg-surface overflow-hidden rounded-2xl border">
            <div className="border-border flex items-center gap-3 border-b px-5 py-4">
                <h2 className="font-semibold">{heading}</h2>
                <span className="bg-surface-subtle text-muted rounded-full px-2 py-0.5 text-xs">
                    {items.length}
                </span>
            </div>
            {items.length === 0 ? (
                <p className="text-muted px-5 py-10 text-center text-sm">{t("empty")}</p>
            ) : (
                <ul className="divide-border divide-y">
                    {items.map((item) => {
                        const title = item.title ?? t("unknownTitle", { id: String(item.tmdbId) });
                        const requester = item.requester?.name
                            ? t("requestedBy", { name: item.requester.name })
                            : item.requester
                              ? t("unknownMember")
                              : t("formerMember");
                        return (
                            <li key={item.id} className="flex flex-wrap items-center gap-4 p-5">
                                <Poster path={item.posterPath} />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="font-medium">
                                        {title}
                                        {item.year && (
                                            <span className="text-muted font-normal">
                                                {" "}
                                                ({item.year})
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
                                        <StatusBadge status={item.status} />
                                        <span>
                                            {requester}
                                            {item.followerCount > 0 &&
                                                ` ${t("plusOthers", { count: String(item.followerCount) })}`}
                                        </span>
                                    </p>
                                    {item.statusDetail && (
                                        <p className="text-muted text-xs">{item.statusDetail}</p>
                                    )}
                                </div>
                                <QueueControls item={item} title={title} />
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
