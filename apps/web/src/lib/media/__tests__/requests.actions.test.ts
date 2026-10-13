import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "@/tests/fakeSupabase";

/**
 * Tests for the members' request actions against an in-memory database: the
 * session, membership and quota checks, and what each action leaves behind.
 * The real membership helpers run against the same fake tables; TMDB is mocked.
 */

const ME = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b1";
const THIRD = "00000000-0000-0000-0000-0000000000c1";
const MOVIE = 157336;
const DAY = 24 * 60 * 60 * 1000;

let db: FakeDb;
let signedIn: { id: string } | null;
let tmdbDown: boolean;

const { refreshMock, getMovieMock } = vi.hoisted(() => ({
    refreshMock: vi.fn(),
    getMovieMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: refreshMock, revalidatePath: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: signedIn } }) },
        from: (table: string) => db.from(table),
    }),
}));
vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: () => ({ from: (table: string) => db.from(table) }),
}));
vi.mock("@/lib/media/tmdb.server", () => ({ getMovie: getMovieMock }));

import { cancelRequest, requestMovie, unfollowRequest } from "../requests.actions";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function member(userId: string, overrides: Row = {}): Row {
    return { user_id: userId, weekly_quota: 5, revoked_at: null, ...overrides };
}

let lastId = 100;
function request(overrides: Row = {}): Row {
    return {
        id: ++lastId,
        media_type: "movie",
        tmdb_id: MOVIE,
        requested_by: OTHER,
        status: "wanted",
        attempts: 0,
        created_at: ago(DAY),
        ...overrides,
    };
}

function follower(requestId: unknown, userId: string, createdAt = ago(DAY)): Row {
    return { request_id: requestId, user_id: userId, created_at: createdAt };
}

function setup(rows: { members?: Row[]; requests?: Row[]; followers?: Row[] } = {}) {
    db = fakeDb(
        {
            media_member: rows.members ?? [member(ME), member(OTHER), member(THIRD)],
            media_request: rows.requests ?? [],
            media_request_follower: rows.followers ?? [],
        },
        {
            unique: {
                media_request: [["media_type", "tmdb_id"]],
                media_request_follower: [["request_id", "user_id"]],
            },
            identity: ["media_request"],
            defaults: {
                media_request: {
                    status: "wanted",
                    attempts: 0,
                    created_at: () => new Date().toISOString(),
                },
                media_request_follower: { created_at: () => new Date().toISOString() },
            },
        }
    );
}

const requests = () => db.tables.media_request;
const followers = () => db.tables.media_request_follower;

beforeEach(() => {
    signedIn = { id: ME };
    tmdbDown = false;
    refreshMock.mockReset();
    getMovieMock.mockReset().mockImplementation(async (id: number) => {
        if (tmdbDown) throw new Error("TMDB unavailable");
        return id === MOVIE || id === 1
            ? { id, title: "Interstellar", year: "2014", posterPath: null }
            : null;
    });
    setup();
});

describe("requestMovie", () => {
    it("creates a request for a new title", async () => {
        expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "requested" });

        expect(requests()).toHaveLength(1);
        expect(requests()[0]).toMatchObject({
            media_type: "movie",
            tmdb_id: MOVIE,
            requested_by: ME,
            status: "wanted",
        });
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it.each([
        ["signed out", () => (signedIn = null)],
        ["never a member", () => setup({ members: [member(OTHER)] })],
        ["revoked", () => setup({ members: [member(ME, { revoked_at: ago(DAY) })] })],
    ])("refuses someone without access (%s)", async (_label, arrange) => {
        arrange();

        expect(await requestMovie(MOVIE)).toEqual({ ok: false, error: "not_member" });
        expect(requests()).toHaveLength(0);
        expect(getMovieMock).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.NaN, 2 ** 31, "157336"])("rejects the id %j", async (id) => {
        expect(await requestMovie(id as number)).toEqual({ ok: false, error: "not_found" });
        expect(getMovieMock).not.toHaveBeenCalled();
    });

    it("rejects a title TMDB doesn't know", async () => {
        expect(await requestMovie(42)).toEqual({ ok: false, error: "not_found" });
        expect(requests()).toHaveLength(0);
    });

    it("fails cleanly when TMDB is down", async () => {
        tmdbDown = true;

        expect(await requestMovie(MOVIE)).toEqual({ ok: false, error: "failed" });
        expect(requests()).toHaveLength(0);
    });

    describe("quota", () => {
        const mine = (n: number, overrides: Row = {}) =>
            Array.from({ length: n }, (_, i) =>
                request({ tmdb_id: 1000 + i, requested_by: ME, created_at: ago(DAY), ...overrides })
            );

        it("stops new requests once this week's are used", async () => {
            setup({ requests: mine(5) });

            expect(await requestMovie(MOVIE)).toEqual({ ok: false, error: "quota_exceeded" });
            expect(requests().some((r) => r.tmdb_id === MOVIE)).toBe(false);
        });

        it("doesn't count requests older than a week or cancelled ones", async () => {
            setup({
                requests: [
                    ...mine(3, { created_at: ago(8 * DAY) }),
                    ...mine(2, { status: "cancelled" }).map((r, i) => ({
                        ...r,
                        tmdb_id: 2000 + i,
                    })),
                    ...mine(4).map((r, i) => ({ ...r, tmdb_id: 3000 + i })),
                ],
            });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "requested" });
        });

        it("still allows a +1 with no requests left", async () => {
            setup({
                members: [member(ME, { weekly_quota: 0 }), member(OTHER)],
                requests: [request({ id: 7 })],
            });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "followed" });
            expect(followers()).toEqual([expect.objectContaining({ request_id: 7, user_id: ME })]);
        });
    });

    describe("a title already in the queue", () => {
        it("adds a +1 to someone else's open request", async () => {
            setup({ requests: [request({ id: 7, status: "searching" })] });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "followed" });
            expect(requests()).toHaveLength(1);
            expect(followers()).toEqual([expect.objectContaining({ request_id: 7, user_id: ME })]);
            expect(refreshMock).toHaveBeenCalledOnce();
        });

        it("adds a +1 to a request whose requester left", async () => {
            setup({ requests: [request({ id: 7, requested_by: null })] });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "followed" });
            expect(requests()[0].requested_by).toBeNull();
        });

        it("says so when you already +1'd it", async () => {
            setup({ requests: [request({ id: 7 })], followers: [follower(7, ME)] });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "already_following" });
            expect(followers()).toHaveLength(1);
            expect(refreshMock).not.toHaveBeenCalled();
        });

        it("says so when it's your own request", async () => {
            setup({ requests: [request({ requested_by: ME })] });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "already_requested" });
            expect(followers()).toHaveLength(0);
        });

        it.each([
            ["available", "available"],
            ["failed", "closed"],
            ["declined", "closed"],
        ])("leaves a %s request as it is", async (status, outcome) => {
            setup({ requests: [request({ status })] });
            const before = structuredClone(requests());

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome });
            expect(requests()).toEqual(before);
            expect(followers()).toHaveLength(0);
            expect(refreshMock).not.toHaveBeenCalled();
        });

        it("reopens a cancelled request as yours", async () => {
            setup({
                requests: [
                    request({
                        id: 7,
                        status: "cancelled",
                        status_detail: "old note",
                        attempts: 3,
                        created_at: ago(30 * DAY),
                    }),
                ],
            });

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "reopened" });
            expect(requests()[0]).toMatchObject({
                id: 7,
                requested_by: ME,
                status: "wanted",
                status_detail: null,
                attempts: 0,
            });
            // Counts as a new request for the quota.
            expect(Date.now() - Date.parse(requests()[0].created_at as string)).toBeLessThan(5000);
        });

        it("counts reopening against the quota", async () => {
            setup({
                members: [member(ME, { weekly_quota: 0 })],
                requests: [request({ status: "cancelled" })],
            });

            expect(await requestMovie(MOVIE)).toEqual({ ok: false, error: "quota_exceeded" });
            expect(requests()[0].status).toBe("cancelled");
        });

        it("adds a +1 when someone else creates the request at the same moment", async () => {
            db.beforeNext("media_request", "insert", () =>
                requests().push(request({ id: 9, requested_by: OTHER, created_at: ago(0) }))
            );

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "followed" });
            expect(requests()).toHaveLength(1);
            expect(followers()).toEqual([expect.objectContaining({ request_id: 9, user_id: ME })]);
        });
    });

    it("reports a database error without changing anything", async () => {
        db.failNext("media_request", "insert");

        expect(await requestMovie(MOVIE)).toEqual({ ok: false, error: "failed" });
        expect(requests()).toHaveLength(0);
    });
});

describe("cancelRequest", () => {
    it.each(["wanted", "proposed"])("cancels your own %s request", async (status) => {
        setup({ requests: [request({ id: 7, requested_by: ME, status })] });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "cancelled" });
        expect(requests()[0]).toMatchObject({ status: "cancelled", requested_by: ME });
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it.each([
        "searching",
        "approved",
        "downloading",
        "available",
        "failed",
        "declined",
        "cancelled",
    ])("can't cancel a %s request", async (status) => {
        setup({ requests: [request({ id: 7, requested_by: ME, status })] });

        expect(await cancelRequest(7)).toEqual({ ok: false, error: "not_cancellable" });
        expect(requests()[0].status).toBe(status);
        // The page refreshes to show the current state.
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("can't cancel someone else's request", async () => {
        setup({
            requests: [request({ id: 7, requested_by: OTHER })],
            followers: [follower(7, ME)],
        });

        expect(await cancelRequest(7)).toEqual({ ok: false, error: "not_cancellable" });
        expect(requests()[0]).toMatchObject({ status: "wanted", requested_by: OTHER });
        expect(followers()).toHaveLength(1);
    });

    it("hands the request to the earliest +1 instead of cancelling it", async () => {
        setup({
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, THIRD, ago(1 * DAY)), follower(7, OTHER, ago(2 * DAY))],
        });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "handed_over" });
        expect(requests()[0]).toMatchObject({ status: "wanted", requested_by: OTHER });
        expect(followers()).toEqual([expect.objectContaining({ user_id: THIRD })]);
    });

    it("skips followers who no longer have access", async () => {
        setup({
            members: [member(ME), member(OTHER, { revoked_at: ago(DAY) }), member(THIRD)],
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, OTHER, ago(2 * DAY)), follower(7, THIRD, ago(1 * DAY))],
        });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "handed_over" });
        expect(requests()[0].requested_by).toBe(THIRD);
    });

    it("never hands the request back to its own requester", async () => {
        setup({
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, ME, ago(3 * DAY))],
        });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "cancelled" });
        expect(requests()[0].status).toBe("cancelled");
    });

    it("cancels when no follower has access any more", async () => {
        setup({
            members: [member(ME), member(OTHER, { revoked_at: ago(DAY) })],
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, OTHER)],
        });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "cancelled" });
        expect(requests()[0]).toMatchObject({ status: "cancelled", requested_by: ME });
    });

    it("refuses someone without access", async () => {
        setup({
            members: [member(ME, { revoked_at: ago(DAY) })],
            requests: [request({ id: 7, requested_by: ME })],
        });

        expect(await cancelRequest(7)).toEqual({ ok: false, error: "not_member" });
        expect(requests()[0].status).toBe("wanted");
    });

    it.each([0, -3, 1.5, "7"])("rejects the id %j", async (id) => {
        expect(await cancelRequest(id as number)).toEqual({ ok: false, error: "not_found" });
    });
});

describe("unfollowRequest", () => {
    it("takes back your +1", async () => {
        setup({
            requests: [request({ id: 7 })],
            followers: [follower(7, ME), follower(7, THIRD)],
        });

        expect(await unfollowRequest(7)).toEqual({ ok: true, outcome: "unfollowed" });
        expect(followers()).toEqual([expect.objectContaining({ user_id: THIRD })]);
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("changes nothing if you hadn't +1'd it", async () => {
        setup({ requests: [request({ id: 7 })], followers: [follower(7, THIRD)] });

        expect(await unfollowRequest(7)).toEqual({ ok: false, error: "changed" });
        expect(followers()).toHaveLength(1);
    });

    it("refuses someone without access", async () => {
        signedIn = null;
        setup({ requests: [request({ id: 7 })], followers: [follower(7, ME)] });

        expect(await unfollowRequest(7)).toEqual({ ok: false, error: "not_member" });
        expect(followers()).toHaveLength(1);
    });
});
