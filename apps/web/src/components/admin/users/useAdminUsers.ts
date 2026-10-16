"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useAdminUsers(viewerId: string) {
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
    const [lastResult, setLastResult] = useState<AdminUsersResult>();
    // Any denial hides the directory, including cached pages and retained rows, until a later
    // request is authorized again. Per-query error state alone would show them on the next key.
    // Keep this latch with the viewer's QueryClient, so remounting or restoring an old server
    // payload cannot reveal rows after denial. Only a successful API response clears it.
    const accessKey = queryKeys.adminUsersAccess(viewerId);
    const { data: forbidden } = useQuery({
        queryKey: accessKey,
        queryFn: skipToken,
        initialData: false,
        gcTime: Infinity,
    });
    const result = useQuery({
        queryKey: queryKeys.adminUsers(viewerId, query.page, query.perPage, query.q),
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/admin/users?${usersSearchParams(query)}`, {
                signal,
                cache: "no-store",
            });
            signal.throwIfAborted();
            if (response.status === 401 || response.status === 403)
                client.setQueryData(accessKey, true);
            if (!response.ok) throw new UsersFetchError(response.status);
            const data: AdminUsersResult = await response.json();
            signal.throwIfAborted();
            if (data.viewerId !== viewerId) {
                client.setQueryData(accessKey, true);
                throw new UsersFetchError(403);
            }
            client.setQueryData(accessKey, false);
            return data;
        },
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        refetchOnMount: forbidden ? "always" : true,
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
            forbidden ||
            !result.data ||
            result.isFetching ||
            result.isPlaceholderData ||
            result.isError ||
            result.data.page === query.page
        )
            return;
        const data = result.data;
        // HydrationBoundary commits newer server data in a parent effect. Let it finish before
        // correcting the URL, otherwise an older cached clamp can send us to the wrong page.
        const timer = setTimeout(() => {
            const current = client.getQueryState(
                queryKeys.adminUsers(viewerId, query.page, query.perPage, query.q)
            );
            if (current?.data !== data || current.status !== "success") return;
            client.setQueryData(
                queryKeys.adminUsers(viewerId, data.page, data.perPage, data.q),
                data,
                { updatedAt: current.dataUpdatedAt }
            );
            updateUrl(data, true);
        }, 0);
        return () => clearTimeout(timer);
    }, [
        client,
        viewerId,
        forbidden,
        query.page,
        query.perPage,
        query.q,
        result.data,
        result.isError,
        result.isFetching,
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
