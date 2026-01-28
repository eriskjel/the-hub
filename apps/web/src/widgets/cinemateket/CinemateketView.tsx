"use client";

import type { CinemateketWidget } from "@/widgets/schema";
import { FilmShowing } from "@/widgets/cinemateket/types";
import React, { ReactElement, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

const INITIAL_COUNT = 2;

export default function CinemateketView({
    data,
    widget: _widget,
}: {
    data: FilmShowing[];
    widget: CinemateketWidget;
}): ReactElement {
    const t = useTranslations("widgets.cinemateket.view");
    const format = useFormatter();
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const listRef = React.useRef<HTMLUListElement>(null);

    if (!data?.length) {
        return <div className="text-sm text-neutral-700">{t("noShowings")}</div>;
    }

    const showings: FilmShowing[] = data;
    const totalMore = Math.max(0, showings.length - INITIAL_COUNT);
    const hasMore = showings.length > INITIAL_COUNT;

    return (
        <div>
            <ul
                ref={listRef}
                id={listId}
                className={`space-y-1 transition-all duration-300 ease-in-out [scrollbar-gutter:stable] [scrollbar-width:thin] ${
                    expanded ? "max-h-64 overflow-y-auto pr-2 md:pr-3" : "max-h-24 overflow-hidden"
                }`}
                aria-live="polite"
            >
                {showings.map((showing, i) => {
                    const isHidden = !expanded && i >= INITIAL_COUNT;
                    return (
                        <li
                            key={`${showing.title}-${showing.showTime}`}
                            className={`rounded-lg px-2 py-2 transition-all duration-300 ease-in-out ${
                                isHidden
                                    ? "pointer-events-none -mt-1 max-h-0 overflow-hidden opacity-0"
                                    : "max-h-none opacity-100"
                            }`}
                        >
                            <div className="flex flex-col gap-1">
                                {/* Title and time */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        {showing.filmUrl ? (
                                            <a
                                                href={showing.filmUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-primary truncate text-sm font-medium text-neutral-900 hover:underline"
                                            >
                                                {showing.title}
                                            </a>
                                        ) : (
                                            <div className="truncate text-sm font-medium text-neutral-900">
                                                {showing.title}
                                            </div>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-sm font-medium whitespace-nowrap text-neutral-700">
                                            {formatShowTime(showing.showTime, format)}
                                        </div>
                                    </div>
                                </div>

                                {/* Director and year */}
                                {(showing.director || showing.year) && (
                                    <div className="truncate text-xs text-neutral-600">
                                        {showing.director || ""}
                                        {showing.director && showing.year ? " " : ""}
                                        {showing.year ? showing.year : ""}
                                    </div>
                                )}

                                {/* Organizer */}
                                {showing.organizer && (
                                    <div className="truncate text-xs text-neutral-500 italic">
                                        {showing.organizer}
                                    </div>
                                )}

                                {/* Ticket link */}
                                {showing.ticketUrl && (
                                    <a
                                        href={showing.ticketUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary-muted mt-0.5 inline-flex w-fit items-center gap-1 text-xs hover:underline"
                                    >
                                        {t("buyTickets")} →
                                    </a>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {hasMore && (
                <button
                    type="button"
                    aria-controls={listId}
                    aria-expanded={expanded}
                    onClick={() => {
                        if (expanded && listRef.current) {
                            listRef.current.scrollTop = 0;
                        }
                        setExpanded((v) => !v);
                    }}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-800 transition-colors duration-200 hover:bg-neutral-100"
                >
                    {expanded ? t("showLess") : t("showMore", { count: totalMore })}
                </button>
            )}
        </div>
    );
}

function formatShowTime(iso: string, format: ReturnType<typeof useFormatter>): string {
    try {
        const date = new Date(iso);
        return format.dateTime(date, {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "Europe/Oslo",
        });
    } catch {
        return iso;
    }
}
