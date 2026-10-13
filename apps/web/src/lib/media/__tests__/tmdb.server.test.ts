import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMovie, searchMovies } from "../tmdb.server";

const TOKEN = "test-token-not-real";

function respond(status: number, body: unknown) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const raw = (overrides: Record<string, unknown> = {}) => ({
    id: 157336,
    title: "Interstellar",
    original_title: "Interstellar",
    release_date: "2014-11-05",
    poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    adult: false,
    ...overrides,
});

beforeEach(() => {
    vi.stubEnv("TMDB_API_TOKEN", TOKEN);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("searchMovies", () => {
    it("asks TMDB with the token, the query and the locale's language", async () => {
        const fetchMock = respond(200, { results: [raw()] });
        vi.stubGlobal("fetch", fetchMock);

        const movies = await searchMovies("inter stellar", "no");

        expect(movies).toEqual([
            {
                id: 157336,
                title: "Interstellar",
                year: "2014",
                posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
            },
        ]);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit & { next?: unknown },
        ];
        const parsed = new URL(url);
        expect(parsed.origin + parsed.pathname).toBe("https://api.themoviedb.org/3/search/movie");
        expect(parsed.searchParams.get("query")).toBe("inter stellar");
        expect(parsed.searchParams.get("language")).toBe("no-NO");
        expect(parsed.searchParams.get("include_adult")).toBe("false");
        expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
        expect(init.next).toEqual({ revalidate: 3600 });
    });

    it("drops adult titles and entries that don't parse, and cleans the rest", async () => {
        vi.stubGlobal(
            "fetch",
            respond(200, {
                results: [
                    raw({ id: 1, adult: true }),
                    { id: "not-a-number" },
                    raw({ id: 2, title: "", original_title: "Original", release_date: "" }),
                    raw({ id: 3, poster_path: "https://evil.example/x.jpg" }),
                    raw({ id: 4, title: null, original_title: null, poster_path: null }),
                ],
            })
        );

        expect(await searchMovies("x", "en")).toEqual([
            {
                id: 2,
                title: "Original",
                year: null,
                posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
            },
            { id: 3, title: "Interstellar", year: "2014", posterPath: null },
            { id: 4, title: "#4", year: "2014", posterPath: null },
        ]);
    });

    it("throws on a TMDB error, without the token in the message", async () => {
        vi.stubGlobal("fetch", respond(401, { status_message: "Invalid API key" }));

        const error = await searchMovies("x", "en").catch((e: Error) => e);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("401");
        expect((error as Error).message).not.toContain(TOKEN);
    });

    it("refuses to run without a token", async () => {
        vi.stubEnv("TMDB_API_TOKEN", "");
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(searchMovies("x", "en")).rejects.toThrow("TMDB_API_TOKEN is not set");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("getMovie", () => {
    it("looks a movie up by id, cached for a day", async () => {
        const fetchMock = respond(200, raw());
        vi.stubGlobal("fetch", fetchMock);

        expect(await getMovie(157336, "en")).toMatchObject({ id: 157336, title: "Interstellar" });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { next?: unknown }];
        expect(url).toBe("https://api.themoviedb.org/3/movie/157336?language=en-US");
        expect(init.next).toEqual({ revalidate: 86400 });
    });

    it.each([
        ["unknown to TMDB", 404, { status_code: 34 }],
        ["an adult title", 200, raw({ adult: true })],
        ["a different movie", 200, raw({ id: 1 })],
    ])("returns null for %s", async (_label, status, body) => {
        vi.stubGlobal("fetch", respond(status, body));

        expect(await getMovie(157336, "en")).toBeNull();
    });

    it("throws when TMDB fails", async () => {
        vi.stubGlobal("fetch", respond(503, {}));

        await expect(getMovie(157336, "en")).rejects.toThrow("503");
    });
});
