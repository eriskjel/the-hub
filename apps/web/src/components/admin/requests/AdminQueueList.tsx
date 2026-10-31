import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ChevronRight, MessageSquareText } from "lucide-react";
import { Poster } from "@/components/requests/Poster";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { ChooseOption, QueueControls } from "@/components/admin/requests/QueueControls";
import type { QueueItem, RequestOption } from "@/lib/media/queue.server";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/utils/cn";
import { describeDetail } from "@/lib/media/detail";
import { describeRemoval } from "@/lib/media/removal";
import { RetentionProvider, ApprovalRetention } from "./RetentionControls";

export async function AdminQueueList({
    items,
    heading,
    empty,
    locale,
    options,
    canChoose = false,
    collapsed = false,
    highlight = false,
}: {
    items: QueueItem[];
    heading: string;
    empty: string;
    locale: Locale;
    /** The proposed releases per request, if this list shows them. */
    options?: Map<number, RequestOption[]>;
    /** A proposal's options can be chosen, because the worker adds the chosen one. */
    canChoose?: boolean;
    /** Starts closed, with only the heading and count showing. Every list can be folded either way. */
    collapsed?: boolean;
    /** Draws attention to the count while the list has items. */
    highlight?: boolean;
}) {
    const [t, tAdmin, tDetail] = await Promise.all([
        getTranslations({ locale, namespace: "requests.queue" }),
        getTranslations({ locale, namespace: "admin.requests" }),
        getTranslations({ locale, namespace: "requests.detail" }),
    ]);
    const header: ReactNode = (
        <>
            <h2 className="font-semibold">{heading}</h2>
            <span
                className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                    highlight && items.length > 0
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-subtle text-muted"
                )}
            >
                {items.length}
            </span>
        </>
    );
    const body =
        items.length === 0 ? (
            <p className="text-muted px-5 py-8 text-center text-sm">{empty}</p>
        ) : (
            <ul className="divide-border divide-y">
                {items.map((item) => {
                    const detail = describeDetail(item, tDetail, locale, "admin");
                    const removal = describeRemoval(item, t, locale);
                    const title = item.title ?? t("unknownTitle", { id: String(item.tmdbId) });
                    const requester = item.requester?.name
                        ? t("requestedBy", { name: item.requester.name })
                        : item.requester
                          ? t("unknownMember")
                          : t("formerMember");
                    const proposed = options?.get(item.id) ?? [];
                    const choosing = canChoose && item.status === "proposed" && proposed.length > 0;
                    return (
                        <RetentionProvider key={`${item.id}:${item.updatedAt}`} item={item}>
                            <li className="flex gap-4 p-5">
                                <Poster path={item.posterPath} />
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 grow basis-60 space-y-1">
                                            <p className="font-medium break-words">
                                                {title}
                                                {item.year && (
                                                    <span className="text-muted font-normal">
                                                        {" "}
                                                        ({item.year})
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
                                                <StatusBadge status={item.status} admin />
                                                <span>
                                                    {requester}
                                                    {item.followerCount > 0 &&
                                                        ` ${t("plusOthers", { count: String(item.followerCount) })}`}
                                                </span>
                                            </p>
                                            {detail && (
                                                <p className="text-muted text-sm break-words">
                                                    {detail}
                                                </p>
                                            )}
                                            {removal && (
                                                <p className="text-muted text-sm">{removal}</p>
                                            )}
                                            {item.notes.map((note, i) => (
                                                <p
                                                    key={i}
                                                    className="bg-surface-subtle flex gap-2 rounded-lg px-3 py-2 text-sm break-words"
                                                >
                                                    <MessageSquareText
                                                        aria-hidden
                                                        className="text-muted mt-0.5 h-4 w-4 shrink-0"
                                                    />
                                                    <span className="min-w-0">
                                                        {note.author.name
                                                            ? tAdmin("note", {
                                                                  name: note.author.name,
                                                                  note: note.text,
                                                              })
                                                            : tAdmin("noteFromMember", {
                                                                  note: note.text,
                                                              })}
                                                    </span>
                                                </p>
                                            ))}
                                        </div>
                                        <QueueControls
                                            item={item}
                                            title={title}
                                            choosing={choosing}
                                        />
                                    </div>
                                    {choosing && item.retention && <ApprovalRetention />}
                                    {proposed.length > 0 && (
                                        <ol
                                            aria-label={tAdmin("options", { title })}
                                            className="border-border divide-border divide-y overflow-hidden rounded-xl border text-sm"
                                        >
                                            {proposed.map((option) => (
                                                <li
                                                    key={option.rank}
                                                    className={cn(
                                                        "flex gap-3 px-3 py-2.5",
                                                        option.rank === 1 && "bg-primary/5"
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                                                            option.rank === 1
                                                                ? "bg-primary/15 text-primary"
                                                                : "bg-surface-subtle text-muted"
                                                        )}
                                                    >
                                                        {option.rank}
                                                    </span>
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium break-words">
                                                            {option.label}
                                                            {option.rank === 1 && (
                                                                <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                                                                    {tAdmin("recommended")}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {option.reason && (
                                                            <p className="text-muted text-xs break-words">
                                                                {option.reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {choosing && (
                                                        <ChooseOption
                                                            item={item}
                                                            rank={option.rank}
                                                            label={option.label}
                                                            title={title}
                                                        />
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            </li>
                        </RetentionProvider>
                    );
                })}
            </ul>
        );

    // Every list folds. `open` is only the starting state: the refresh leaves an admin's toggle alone.
    return (
        <details open={!collapsed} className="group border-border bg-surface rounded-2xl border">
            <summary className="focus-visible:ring-border flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 focus:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                    aria-hidden
                    className="text-muted h-4 w-4 transition-transform group-open:rotate-90"
                />
                {header}
            </summary>
            <div className="border-border border-t">{body}</div>
        </details>
    );
}
