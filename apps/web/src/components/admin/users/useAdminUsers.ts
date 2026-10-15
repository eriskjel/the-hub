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
    const client = useQueryClient();
    const [lastResult, setLastResult] = useState(initialData);
    const matchesInitial =
        query.page === initialQuery.page &&
        query.perPage === initialQuery.perPage &&
        query.q === initialQuery.q;
    const result = useQuery({
        queryKey: queryKeys.adminUsers(initialData.viewerId, query.page, query.perPage, query.q),
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/admin/users?${usersSearchParams(query)}`, {
                signal,
                cache: "no-store",
            });
            if (!response.ok) throw new UsersFetchError(response.status);
            const data: AdminUsersResult = await response.json();
            if (data.viewerId !== initialData.viewerId) throw new UsersFetchError(403);
            return data;
        },
        initialData: matchesInitial ? initialData : undefined,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: false,
    });

    if (result.data && !result.isPlaceholderData && result.data !== lastResult)
        setLastResult(result.data);
    const forbidden =
        result.error instanceof UsersFetchError && [401, 403].includes(result.error.status);
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
    };
}
