"use client";

import type { CinemateketWidget } from "@/widgets/schema";
import { FilmShowing } from "@/widgets/cinemateket/types";
import React, { ReactElement, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDown, ExternalLink } from "lucide-react";

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
        return <div className="text-muted-light text-sm">{t("noShowings")}</div>;
    }

    const showings: FilmShowing[] = data;
    const totalMore = Math.max(0, showings.length - INITIAL_COUNT);
    const hasMore = showings.length > INITIAL_COUNT;

    return (
        <>
            <ul
                ref={listRef}
                id={listId}
                className={`transition-all duration-300 ease-in-out [scrollbar-gutter:stable] [scrollbar-width:thin] ${
                    expanded
                        ? "max-h-64 space-y-2 overflow-y-auto pr-2 md:pr-3"
                        : "max-h-24 space-y-px overflow-hidden"
                }`}
                aria-live="polite"
            >
                {showings.map((showing, i) => {
                    const isHidden = !expanded && i >= INITIAL_COUNT;
                    return (
                        <li
                            key={`${showing.title}-${showing.showTime}`}
                            className={`hover:bg-surface-subtle rounded-lg px-2 py-1 transition-opacity duration-200 ease-in-out ${
                                isHidden ? "pointer-events-none opacity-0" : "opacity-100"
                            }`}
                        >
                            <div className="flex flex-col gap-px">
                                {/* Title and time */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        {showing.filmUrl ? (
                                            <a
                                                href={showing.filmUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-primary text-foreground truncate text-sm font-medium hover:underline"
                                            >
                                                {showing.title}
                                            </a>
                                        ) : (
                                            <div className="text-foreground truncate text-sm font-medium">
                                                {showing.title}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-muted-light shrink-0 text-right text-sm font-medium whitespace-nowrap">
                                        {formatShowTime(showing.showTime, format)}
                                    </div>
                                </div>

                                {/* Director and year */}
                                {(showing.director || showing.year) && (
                                    <div className="text-muted truncate text-xs">
                                        {showing.director || ""}
                                        {showing.director && showing.year ? " " : ""}
                                        {showing.year ? showing.year : ""}
                                    </div>
                                )}

                                {/* Organizer */}
                                {showing.organizer && (
                                    <div className="text-muted-subtle truncate text-xs italic">
                                        {showing.organizer}
                                    </div>
                                )}

                                {/* Buy tickets and date */}
                                <div className="flex items-center justify-between gap-2">
                                    {showing.ticketUrl ? (
                                        <a
                                            href={showing.ticketUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:text-primary-muted inline-flex w-fit items-center gap-1 text-xs hover:underline"
                                        >
                                            {t("buyTickets")}
                                            <ExternalLink
                                                className="h-3 w-3 shrink-0"
                                                aria-hidden
                                            />
                                        </a>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="text-muted text-right text-xs">
                                        {formatShowDate(showing.showTime, format)}
                                    </div>
                                </div>
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
                    className="group bg-surface-subtle/50 text-muted hover:bg-surface-subtle hover:text-primary mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200"
                >
                    <span>{expanded ? t("showLess") : t("showMore", { count: totalMore })}</span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            expanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                    />
                </button>
            )}
        </>
    );
}

function formatShowDate(iso: string, format: ReturnType<typeof useFormatter>): string {
    try {
        const date = new Date(iso);
        return format.dateTime(date, {
            dateStyle: "short",
            timeZone: "Europe/Oslo",
        });
    } catch {
        return iso;
    }
}

function formatShowTime(iso: string, format: ReturnType<typeof useFormatter>): string {
    try {
        const date = new Date(iso);
        return format.dateTime(date, {
            timeStyle: "short",
            timeZone: "Europe/Oslo",
        });
    } catch {
        return iso;
    }
}
