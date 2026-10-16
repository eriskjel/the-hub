import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Poster } from "@/components/requests/Poster";
import { RequestControls } from "@/components/requests/RequestControls";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { QueueItem } from "@/lib/media/queue.server";

export function QueueList({
    heading,
    items,
    empty,
}: {
    heading: string;
    items: QueueItem[];
    empty?: string;
}): ReactElement | null {
    if (items.length === 0 && !empty) return null;
    return (
        <section className="space-y-2">
            <h2 className="text-foreground font-semibold">{heading}</h2>
            {items.length === 0 ? (
                <p className="text-muted text-sm">{empty}</p>
            ) : (
                <ul className="divide-border divide-y">
                    {items.map((item) => (
                        <QueueRow key={item.id} item={item} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function QueueRow({ item }: { item: QueueItem }): ReactElement {
    const t = useTranslations("requests.queue");
    const title = item.title ?? t("unknownTitle", { id: String(item.tmdbId) });

    const requester = !item.requester
        ? t("formerMember")
        : item.requester.isYou
          ? t("requestedByYou")
          : item.requester.name
            ? t("requestedBy", { name: item.requester.name })
            : t("unknownMember");

    return (
        <li className="flex items-center gap-3 py-2">
            <Poster path={item.posterPath} />
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-foreground truncate font-medium">
                    {title}
                    {item.year && <span className="text-muted font-normal"> ({item.year})</span>}
                </p>
                <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <StatusBadge status={item.status} />
                    <span>
                        {requester}
                        {item.followerCount > 0 &&
                            ` ${t("plusOthers", { count: String(item.followerCount) })}`}
                    </span>
                </p>
                {/* A proposal's details are for the admin; members see that it waits for approval. */}
                {item.statusDetail && item.status !== "proposed" && (
                    <p className="text-muted text-xs">{item.statusDetail}</p>
                )}
            </div>
            <RequestControls
                tmdbId={item.tmdbId}
                title={title}
                request={{ id: item.id, status: item.status, role: item.role }}
            />
        </li>
    );
}
