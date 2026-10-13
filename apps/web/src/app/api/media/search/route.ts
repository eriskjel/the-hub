import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";
import { getOwnMembership } from "@/lib/media/membership.server";
import { searchMovies } from "@/lib/media/tmdb.server";
import {
    SEARCH_MAX_LENGTH,
    SEARCH_MIN_LENGTH,
    type RequestStatus,
    type SearchResult,
} from "@/lib/media/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/media/search?q=…&locale=en|no
 * Members only. Searches TMDB for movies and marks the ones already in the
 * request queue, read with the member's own session (RLS).
 */
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let membership;
    try {
        membership = await getOwnMembership(user.id);
    } catch (e) {
        console.error("media search:", (e as Error).message);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (!membership?.active) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < SEARCH_MIN_LENGTH || query.length > SEARCH_MAX_LENGTH) {
        return NextResponse.json({ error: "invalid_query" }, { status: 400 });
    }
    const localeParam = req.nextUrl.searchParams.get("locale") ?? "";
    const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

    let movies;
    try {
        movies = await searchMovies(query, locale);
    } catch (e) {
        console.error("media search: TMDB failed:", (e as Error).message);
        return NextResponse.json({ error: "search_unavailable" }, { status: 502 });
    }

    const queued = new Map<number, NonNullable<SearchResult["request"]>>();
    if (movies.length > 0) {
        const { data: requests, error } = await supabase
            .from("media_request")
            .select("id, tmdb_id, status, requested_by")
            .eq("media_type", "movie")
            .neq("status", "cancelled")
            .in(
                "tmdb_id",
                movies.map((m) => m.id)
            );
        if (error) {
            console.error("media search: queue read failed:", error.message);
            return NextResponse.json({ error: "server_error" }, { status: 500 });
        }

        const rows = (requests ?? []) as {
            id: number;
            tmdb_id: number;
            status: RequestStatus;
            requested_by: string | null;
        }[];
        let following = new Set<number>();
        if (rows.length > 0) {
            const { data: follows, error: followError } = await supabase
                .from("media_request_follower")
                .select("request_id")
                .eq("user_id", user.id)
                .in(
                    "request_id",
                    rows.map((r) => r.id)
                );
            if (followError) {
                console.error("media search: follower read failed:", followError.message);
                return NextResponse.json({ error: "server_error" }, { status: 500 });
            }
            following = new Set((follows ?? []).map((f) => f.request_id as number));
        }

        for (const row of rows) {
            queued.set(row.tmdb_id, {
                id: row.id,
                status: row.status,
                role:
                    row.requested_by === user.id
                        ? "requester"
                        : following.has(row.id)
                          ? "follower"
                          : null,
            });
        }
    }

    const results: SearchResult[] = movies.map((m) => ({
        tmdbId: m.id,
        title: m.title,
        year: m.year,
        posterPath: m.posterPath,
        request: queued.get(m.id) ?? null,
    }));
    return NextResponse.json({ results });
}
