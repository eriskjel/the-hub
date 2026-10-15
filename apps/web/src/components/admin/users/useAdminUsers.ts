"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { queryKeys } from "@/lib/queryKeys";
import {
    parseUsersQuery,
    usersSearchParams,
    type AdminUsersQuery,
    type AdminUsersResult,
} from "@/lib/admin/users";

class UsersFetchError extends Error {
    constructor(public status: number) {
        super("Users could not be loaded");
    }
}

const cleanSearch = (value: string) => value.trim().slice(0, 100);

function updateUrl(query: AdminUsersQuery, replace = false) {
    const url = new URL(window.location.href);
    const next = usersSearchParams(query);
    for (const key of ["page", "per", "q"]) {
        const value = next.get(key);
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
    }
    // Native history integrates with Next's search params without another RSC fetch.
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
}

export function useAdminUsers(initialData: AdminUsersResult, initialQuery: AdminUsersQuery) {
    const params = useSearchParams();
    const query = parseUsersQuery({
        page: params.get("page") ?? undefined,
        per: params.get("per") ?? undefined,
        q: params.get("q") ?? undefined,
    });
    const [searchText, setSearchText] = useState(query.q);
    const [composing, setComposing] = useState(false);
    const urlState = usersSearchParams(query).toString();
    const [seenUrlState, setSeenUrlState] = useState(urlState);
    // Any URL change (Back/Forward, paging, links) replaces an unsent draft, which also cancels
    // its pending search, without remounting the input. The debounced update below lands here
    // too, so keep a draft it already matches, e.g. "erik " mid-typing.
    if (seenUrlState !== urlState) {
        setSeenUrlState(urlState);
        if (cleanSearch(searchText) !== query.q) setSearchText(query.q);
    }
    useEffect(() => {
        const q = cleanSearch(searchText);
        if (composing || q === query.q) return;
        const timer = setTimeout(() => {
            // Typing edits the current entry rather than adding a history entry per pause.
            updateUrl({ page: 1, perPage: query.perPage, q }, true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchText, composing, query.q, query.perPage]);

    function clearSearch() {
        setSearchText("");
        if (query.q) updateUrl({ ...query, q: "", page: 1 }, true);
    }

    /** Enter searches right away instead of waiting for the pause. */
    function submitSearch() {
        const q = cleanSearch(searchText);
        if (!composing && q !== query.q) updateUrl({ ...query, q, page: 1 }, true);
    }
    const client = useQueryClient();
    const [lastResult, setLastResult] = useState(initialData);
    const matchesInitial =
        query.page === initialQuery.page &&
        query.perPage === initialQuery.perPage &&
        query.q === initialQuery.q;
    // Any denial hides the directory, including cached pages and retained rows, until a later
    // request is authorized again. Per-query error state alone would show them on the next key.
    const [forbidden, setForbidden] = useState(false);
    const result = useQuery({
        queryKey: queryKeys.adminUsers(initialData.viewerId, query.page, query.perPage, query.q),
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/admin/users?${usersSearchParams(query)}`, {
                signal,
                cache: "no-store",
            });
            if (response.status === 401 || response.status === 403) setForbidden(true);
            if (!response.ok) throw new UsersFetchError(response.status);
            const data: AdminUsersResult = await response.json();
            if (data.viewerId !== initialData.viewerId) {
                setForbidden(true);
                throw new UsersFetchError(403);
            }
            setForbidden(false);
            return data;
        },
        initialData: matchesInitial ? initialData : undefined,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: false,
    });

    if (result.data && !result.isPlaceholderData && result.data !== lastResult)
        setLastResult(result.data);
    const shown = forbidden ? undefined : (result.data ?? lastResult);
    const fetching = result.isFetching;
    const waiting = result.isPlaceholderData || result.isPending;
    const totalPages = Math.max(
        1,
        Math.ceil((shown?.total ?? 0) / (shown?.perPage ?? query.perPage))
    );
    const returnQuery = usersSearchParams(shown ?? query).toString();

    // Clamp old bookmarks after deletions, and cache the canonical page before changing its key.
    useEffect(() => {
        if (
            !result.data ||
            result.isPlaceholderData ||
            result.isError ||
            result.data.page === query.page
        )
            return;
        client.setQueryData(
            queryKeys.adminUsers(
                initialData.viewerId,
                result.data.page,
                result.data.perPage,
                result.data.q
            ),
            result.data
        );
        updateUrl(result.data, true);
    }, [
        client,
        initialData.viewerId,
        query.page,
        result.data,
        result.isError,
        result.isPlaceholderData,
    ]);

    return {
        query,
        result,
        shown,
        forbidden,
        fetching,
        waiting,
        totalPages,
        returnQuery,
        updateUrl,
        searchText,
        setSearchText,
        setComposing,
        clearSearch,
        submitSearch,
    };
}
