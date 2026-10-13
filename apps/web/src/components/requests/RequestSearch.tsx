"use client";

import { useState, type ReactElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FieldText } from "@/components/ui/Fields";
import { Poster } from "@/components/requests/Poster";
import { RequestControls } from "@/components/requests/RequestControls";
import { SEARCH_QUERY_KEY } from "@/components/requests/RequestButton";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type SearchResult } from "@/lib/media/request";

const DEBOUNCE_MS = 300;

export default function RequestSearch(): ReactElement {
    const t = useTranslations("requests.search");
    const locale = useLocale();
    const [input, setInput] = useState("");
    const [query, setQuery] = useState("");
    const debounce = useDebouncedCallback(DEBOUNCE_MS);

    const enabled = query.length >= SEARCH_MIN_LENGTH;
    const search = useQuery({
        queryKey: [SEARCH_QUERY_KEY, locale, query],
        queryFn: async ({ signal }): Promise<SearchResult[]> => {
            const params = new URLSearchParams({ q: query, locale });
            const res = await fetch(`/api/media/search?${params}`, { signal });
            if (!res.ok) throw new Error(`media search ${res.status}`);
            return ((await res.json()) as { results: SearchResult[] }).results;
        },
        enabled,
        // Keep the last results on screen while the next query loads.
        placeholderData: (previous) => previous,
        staleTime: 60_000,
        retry: false,
    });

    const status = !enabled
        ? null
        : search.isError
          ? t("failed")
          : search.isPending
            ? t("loading")
            : search.data.length === 0
              ? t("empty")
              : null;

    return (
        <section className="space-y-3">
            <FieldText
                label={t("label")}
                type="search"
                value={input}
                onChange={(e) => {
                    const value = e.target.value;
                    setInput(value);
                    debounce(() => setQuery(value.trim()));
                }}
                placeholder={t("placeholder")}
                maxLength={SEARCH_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
            />
            <p role="status" aria-live="polite" className="text-muted min-h-5 text-sm">
                {status}
            </p>
            {enabled && search.data && search.data.length > 0 && (
                <ul className="divide-border divide-y">
                    {search.data.map((r) => (
                        <li key={r.tmdbId} className="flex items-center gap-3 py-2">
                            <Poster path={r.posterPath} />
                            <div className="min-w-0 flex-1">
                                <p className="text-foreground truncate font-medium">
                                    {r.title}
                                    {r.year && (
                                        <span className="text-muted font-normal"> ({r.year})</span>
                                    )}
                                </p>
                                {r.request && <StatusBadge status={r.request.status} />}
                            </div>
                            <RequestControls
                                tmdbId={r.tmdbId}
                                title={r.title}
                                request={r.request}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
