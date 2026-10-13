import "server-only";

import { z } from "zod";
import type { Locale } from "@/i18n/routing";

/**
 * TMDB API (v3 endpoints, v4 read access token). Only the server talks to
 * TMDB; the token never reaches the browser. Responses go through Next's data
 * cache, which also keeps us far below TMDB's rate limits.
 */
const TMDB_API = "https://api.themoviedb.org/3";
const SEARCH_REVALIDATE_S = 60 * 60;
const DETAILS_REVALIDATE_S = 24 * 60 * 60;
const TIMEOUT_MS = 8000;

const TMDB_LANGUAGE: Record<Locale, string> = { en: "en-US", no: "no-NO" };

export type TmdbMovie = {
    id: number;
    title: string;
    year: string | null;
    posterPath: string | null;
};

const movieSchema = z.object({
    id: z.number().int().positive(),
    title: z.string().catch(""),
    original_title: z.string().catch(""),
    release_date: z.string().nullish(),
    poster_path: z.string().nullish(),
    adult: z.boolean().catch(false),
});
type RawMovie = z.infer<typeof movieSchema>;

const searchSchema = z.object({ results: z.array(z.unknown()) });

export class TmdbError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TmdbError";
    }
}

/** Movies matching `query`, adult titles excluded (first page, up to 20). */
export async function searchMovies(query: string, locale: Locale): Promise<TmdbMovie[]> {
    const params = new URLSearchParams({
        query,
        include_adult: "false",
        language: TMDB_LANGUAGE[locale],
        page: "1",
    });
    const res = await tmdbFetch(`/search/movie?${params}`, SEARCH_REVALIDATE_S);
    if (!res.ok) throw new TmdbError(`search failed: ${res.status}`);

    const body = searchSchema.parse(await res.json());
    return body.results.flatMap((raw) => {
        const movie = movieSchema.safeParse(raw);
        return movie.success && !movie.data.adult ? [toMovie(movie.data)] : [];
    });
}

/** One movie, or null if TMDB doesn't know it (or it's an adult title). */
export async function getMovie(id: number, locale: Locale): Promise<TmdbMovie | null> {
    const params = new URLSearchParams({ language: TMDB_LANGUAGE[locale] });
    const res = await tmdbFetch(`/movie/${id}?${params}`, DETAILS_REVALIDATE_S);
    if (res.status === 404) return null;
    if (!res.ok) throw new TmdbError(`movie lookup failed: ${res.status}`);

    const movie = movieSchema.safeParse(await res.json());
    if (!movie.success || movie.data.id !== id || movie.data.adult) return null;
    return toMovie(movie.data);
}

function tmdbFetch(path: string, revalidate: number): Promise<Response> {
    const token = process.env.TMDB_API_TOKEN?.trim();
    if (!token) throw new TmdbError("TMDB_API_TOKEN is not set");
    return fetch(`${TMDB_API}${path}`, {
        headers: { accept: "application/json", authorization: `Bearer ${token}` },
        next: { revalidate },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
}

function toMovie(raw: RawMovie): TmdbMovie {
    const year = raw.release_date?.slice(0, 4);
    return {
        id: raw.id,
        title: raw.title || raw.original_title || `#${raw.id}`,
        year: year && /^\d{4}$/.test(year) ? year : null,
        // Goes into an image URL, so accept only TMDB's plain "/abc.jpg" shape.
        posterPath:
            raw.poster_path && /^\/[\w-]+\.(jpg|png)$/.test(raw.poster_path)
                ? raw.poster_path
                : null,
    };
}
