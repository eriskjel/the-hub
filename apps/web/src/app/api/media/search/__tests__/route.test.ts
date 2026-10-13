import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeDb, type FakeDb, type Row } from "@/tests/fakeSupabase";

/** Route tests for GET /api/media/search, with TMDB mocked and an in-memory database. */

const ME = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b1";

let db: FakeDb;
let signedIn: { id: string } | null;

const { searchMoviesMock } = vi.hoisted(() => ({ searchMoviesMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: signedIn } }) },
        from: (table: string) => db.from(table),
    }),
}));
vi.mock("@/lib/media/tmdb.server", () => ({ searchMovies: searchMoviesMock }));

import { GET } from "../route";

const movie = (id: number, title = `Movie ${id}`) => ({
    id,
    title,
    year: "2014",
    posterPath: "/p.jpg",
});

function setup(rows: { members?: Row[]; requests?: Row[]; followers?: Row[] } = {}) {
    db = fakeDb({
        media_member: rows.members ?? [{ user_id: ME, weekly_quota: 5, revoked_at: null }],
        media_request: rows.requests ?? [],
        media_request_follower: rows.followers ?? [],
    });
}

const get = (params: Record<string, string>) =>
    GET(new NextRequest(`http://localhost/api/media/search?${new URLSearchParams(params)}`));

beforeEach(() => {
    signedIn = { id: ME };
    searchMoviesMock.mockReset().mockResolvedValue([movie(1), movie(2), movie(3), movie(4)]);
    setup();
});

describe("GET /api/media/search", () => {
    it("requires a session", async () => {
        signedIn = null;
        const res = await get({ q: "inter" });

        expect(res.status).toBe(401);
        expect(searchMoviesMock).not.toHaveBeenCalled();
    });

    it.each([
        ["never a member", []],
        ["revoked", [{ user_id: ME, weekly_quota: 5, revoked_at: "2026-10-01T00:00:00+00:00" }]],
    ])("is for members only (%s)", async (_label, members) => {
        setup({ members });
        const res = await get({ q: "inter" });

        expect(res.status).toBe(403);
        expect(searchMoviesMock).not.toHaveBeenCalled();
    });

    it.each<Record<string, string>>([{}, { q: "" }, { q: " a " }, { q: "x".repeat(101) }])(
        "rejects the query %j",
        async (params) => {
            const res = await get(params);

            expect(res.status).toBe(400);
            expect(searchMoviesMock).not.toHaveBeenCalled();
        }
    );

    it("searches in the page's language, defaulting to Norwegian", async () => {
        await get({ q: "  interstellar ", locale: "en" });
        await get({ q: "interstellar", locale: "de" });

        expect(searchMoviesMock.mock.calls).toEqual([
            ["interstellar", "en"],
            ["interstellar", "no"],
        ]);
    });

    it("marks titles already in the queue and your part in them", async () => {
        setup({
            requests: [
                { id: 11, media_type: "movie", tmdb_id: 1, status: "wanted", requested_by: ME },
                {
                    id: 12,
                    media_type: "movie",
                    tmdb_id: 2,
                    status: "searching",
                    requested_by: OTHER,
                },
                {
                    id: 13,
                    media_type: "movie",
                    tmdb_id: 3,
                    status: "available",
                    requested_by: null,
                },
                // Cancelled requests count as not requested.
                {
                    id: 14,
                    media_type: "movie",
                    tmdb_id: 4,
                    status: "cancelled",
                    requested_by: OTHER,
                },
                // A different media type with the same id is a different title.
                { id: 15, media_type: "tv", tmdb_id: 3, status: "wanted", requested_by: ME },
            ],
            followers: [
                { request_id: 12, user_id: ME },
                { request_id: 13, user_id: OTHER },
            ],
        });
        const res = await get({ q: "inter" });

        expect(res.status).toBe(200);
        const { results } = await res.json();
        expect(results.map((r: { request: unknown }) => r.request)).toEqual([
            { id: 11, status: "wanted", role: "requester" },
            { id: 12, status: "searching", role: "follower" },
            { id: 13, status: "available", role: null },
            null,
        ]);
        expect(results[0]).toMatchObject({
            tmdbId: 1,
            title: "Movie 1",
            year: "2014",
            posterPath: "/p.jpg",
        });
    });

    it("reports TMDB being down as a bad gateway", async () => {
        searchMoviesMock.mockRejectedValueOnce(new Error("TMDB search failed: 503"));
        const res = await get({ q: "inter" });

        expect(res.status).toBe(502);
        expect(await res.json()).toEqual({ error: "search_unavailable" });
    });

    it("returns an empty list without querying the queue", async () => {
        searchMoviesMock.mockResolvedValueOnce([]);
        db.failNext("media_request", "select");
        const res = await get({ q: "zzzz" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ results: [] });
    });
});
