import type { ReactElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import { describeDetail } from "@/lib/media/detail";
import { describeRemoval } from "@/lib/media/removal";
import { Poster } from "@/components/requests/Poster";
import { RequestControls } from "@/components/requests/RequestControls";
import { StatusBadge } from "@/components/requests/StatusBadge";
import type { QueueItem } from "@/lib/media/queue.server";
import { cn } from "@/utils/cn";

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
                <ul className="divide-border -mx-2 divide-y">
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
    const tDetail = useTranslations("requests.detail");
    const locale = useLocale();
    const detail = describeDetail(item, tDetail, locale, "member");
    const removal = describeRemoval(item, t, locale);
    const title = item.title ?? t("unknownTitle", { id: String(item.tmdbId) });
    const note = item.notes.find((n) => n.author.isYou);

    const requester = !item.requester
        ? t("formerMember")
        : item.requester.isYou
          ? t("requestedByYou")
          : item.requester.name
            ? t("requestedBy", { name: item.requester.name })
            : t("unknownMember");

    // The rows "Mine" shows stand out in the full list too.
    return (
        <li
            className={cn(
                "flex items-center gap-3 px-2 py-2",
                item.role && "bg-primary/5 shadow-[inset_3px_0_0_var(--color-primary)]"
            )}
        >
            <Poster path={item.posterPath} />
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-foreground truncate font-medium">
                    {title}
                    {item.year && <span className="text-muted font-normal"> ({item.year})</span>}
                </p>
                <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <StatusBadge status={item.status} />
                    <span>
                        <span
                            className={cn(item.role === "requester" && "text-primary font-medium")}
                        >
                            {requester}
                        </span>
                        {item.followerCount > 0 &&
                            ` ${t("plusOthers", { count: String(item.followerCount) })}`}
                    </span>
                    {item.role === "follower" && (
                        <span className="text-primary font-medium">{t("yourPlusOne")}</span>
                    )}
                </p>
                {detail && <p className="text-muted text-xs">{detail}</p>}
                {removal && <p className="text-muted text-xs">{removal}</p>}
                {note && (
                    <p className="text-muted text-xs break-words">
                        {t("yourNote", { note: note.text })}
                    </p>
                )}
            </div>
            <RequestControls
                tmdbId={item.tmdbId}
                title={title}
                request={{
                    id: item.id,
                    status: item.status,
                    role: item.role,
                    removal: item.removal,
                }}
            />
        </li>
    );
}
