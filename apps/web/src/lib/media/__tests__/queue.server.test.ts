import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb, type FakeDb } from "@/tests/fakeSupabase";

const ME = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b1";
const NAMELESS = "00000000-0000-0000-0000-0000000000c1";

const { getMovieMock } = vi.hoisted(() => ({ getMovieMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/media/tmdb.server", () => ({ getMovie: getMovieMock }));

import { getQueue, getRequestOptions } from "../queue.server";

let db: FakeDb;
const client = () => db as unknown as SupabaseClient;

const req = (
    id: number,
    tmdbId: number,
    requestedBy: string | null,
    status = "wanted",
    createdAt = "2026-10-0" + id
) => ({
    id,
    media_type: "movie",
    tmdb_id: tmdbId,
    status,
    status_detail: null,
    requested_by: requestedBy,
    created_at: createdAt,
    updated_at: createdAt,
});

beforeEach(() => {
    getMovieMock.mockReset().mockImplementation(async (id: number) => {
        if (id === 999) throw new Error("TMDB unavailable");
        return { id, title: `Movie ${id}`, year: "2014", posterPath: "/p.jpg" };
    });
    db = fakeDb(
        {
            media_request: [
                req(1, 101, ME),
                req(2, 102, OTHER),
                req(3, 103, null, "available"),
                req(4, 999, NAMELESS),
                req(5, 105, ME, "cancelled"),
                { ...req(6, 106, ME), media_type: "tv" },
            ],
            media_request_follower: [
                { request_id: 2, user_id: ME },
                { request_id: 2, user_id: NAMELESS },
                { request_id: 3, user_id: OTHER },
            ],
            profiles: [
                { id: ME, full_name: "Me Myself", username: "me" },
                { id: OTHER, full_name: null, username: "other" },
                { id: NAMELESS, full_name: null, username: null },
            ],
        },
        { embeds: { media_request_follower: { foreignKey: "request_id" } } }
    );
});

describe("getQueue", () => {
    it("includes cancelled requests for the admin queue only", async () => {
        const queue = await getQueue(client(), ME, "en", { admin: true });
        expect(queue.find((item) => item.id === 5)?.status).toBe("cancelled");
        expect((await getQueue(client(), ME, "en")).some((item) => item.id === 5)).toBe(false);
    });

    it("lists closed requests for admins by last change, apart from available titles", async () => {
        db.tables.media_request = [
            // Requested long ago, failed just now.
            { ...req(1, 101, ME, "failed", "2020-01-01"), updated_at: "2026-10-10" },
            { ...req(2, 102, ME, "declined", "2026-09-01"), updated_at: "2026-09-02" },
            ...Array.from({ length: 200 }, (_, i) =>
                req(i + 3, i + 103, OTHER, "available", "2026-10-01")
            ),
        ];

        const queue = await getQueue(client(), ME, "en", { admin: true });
        expect(queue.filter((q) => q.status !== "available").map((q) => q.id)).toEqual([1, 2]);
        expect(queue.filter((q) => q.status === "available")).toHaveLength(200);
    });
    it("lists open movie requests oldest first, then history, without cancelled ones", async () => {
        const queue = await getQueue(client(), ME, "en");

        expect(queue.map((q) => q.id)).toEqual([1, 2, 4, 3]);
    });

    it("keeps the oldest open request when 200 newer completed titles exist", async () => {
        db.tables.media_request = [
            req(1, 101, ME, "wanted", "2020-01-01"),
            ...Array.from({ length: 200 }, (_, i) =>
                req(i + 2, i + 102, OTHER, "available", "2026-10-01")
            ),
        ];

        const queue = await getQueue(client(), ME, "en");
        expect(queue).toHaveLength(201);
        expect(queue[0]).toMatchObject({ id: 1, status: "wanted" });
        expect(queue.slice(1).map((q) => q.id)).toEqual(
            Array.from({ length: 200 }, (_, i) => 201 - i)
        );
    });

    it("prioritizes the oldest open work when the open queue itself exceeds the limit", async () => {
        db.tables.media_request = Array.from({ length: 201 }, (_, i) =>
            req(i + 1, i + 101, ME, "wanted", "2026-10-01")
        );

        const queue = await getQueue(client(), ME, "en");
        expect(queue.map((q) => q.id)).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));
    });

    it("names the requester and shows your part in each request", async () => {
        const byId = new Map((await getQueue(client(), ME, "en")).map((q) => [q.id, q]));

        expect(byId.get(1)).toMatchObject({
            requester: { name: "Me Myself", isYou: true },
            role: "requester",
            followerCount: 0,
        });
        expect(byId.get(2)).toMatchObject({
            requester: { name: "other", isYou: false },
            role: "follower",
            followerCount: 2,
        });
        // The requester's account was deleted.
        expect(byId.get(3)).toMatchObject({ requester: null, role: null, followerCount: 1 });
        expect(byId.get(4)).toMatchObject({ requester: { name: null, isYou: false } });
    });

    it("fills in titles from TMDB in the page's language, and still lists a title TMDB can't return", async () => {
        const byId = new Map((await getQueue(client(), ME, "no")).map((q) => [q.id, q]));

        expect(byId.get(1)).toMatchObject({
            tmdbId: 101,
            title: "Movie 101",
            year: "2014",
            posterPath: "/p.jpg",
        });
        expect(byId.get(4)).toMatchObject({
            tmdbId: 999,
            title: null,
            year: null,
            posterPath: null,
        });
        expect(getMovieMock).toHaveBeenCalledWith(101, "no");
    });

    it("still renders when names can't be read", async () => {
        db.failNext("profiles", "select");

        const queue = await getQueue(client(), ME, "en");
        expect(queue.find((q) => q.id === 1)?.requester).toEqual({ name: null, isYou: true });
    });

    it("throws when the queue itself can't be read", async () => {
        db.failNext("media_request", "select");

        await expect(getQueue(client(), ME, "en")).rejects.toThrow("media queue read failed");
    });

    it("throws when the history can't be read", async () => {
        db.beforeNext("media_request", "select", () => {
            db.beforeNext("media_request", "select", () => db.failNext("media_request", "select"));
        });

        await expect(getQueue(client(), ME, "en")).rejects.toThrow("media queue read failed");
    });
});

describe("getRequestOptions", () => {
    const option = (requestId: number, rank: number, reason: string | null = null) => ({
        request_id: requestId,
        rank,
        label: `Group ${rank} · 2160p · ${50 - rank} GB`,
        reason,
    });

    it("groups the options per request, best first, for the asked requests only", async () => {
        db.tables.media_request_option = [
            option(1, 2),
            option(1, 1, "listed group"),
            option(2, 1),
            option(3, 1),
        ];

        const options = await getRequestOptions(client(), [1, 2]);
        expect(options.get(1)).toEqual([
            { rank: 1, label: "Group 1 · 2160p · 49 GB", reason: "listed group" },
            { rank: 2, label: "Group 2 · 2160p · 48 GB", reason: null },
        ]);
        expect(options.get(2)).toHaveLength(1);
        expect(options.has(3)).toBe(false);
    });

    it("skips the read when no request needs options", async () => {
        db.failNext("media_request_option", "select");

        await expect(getRequestOptions(client(), [])).resolves.toEqual(new Map());
    });

    it("throws when the options can't be read", async () => {
        db.tables.media_request_option = [];
        db.failNext("media_request_option", "select");

        await expect(getRequestOptions(client(), [1])).rejects.toThrow("media options read failed");
    });
});
