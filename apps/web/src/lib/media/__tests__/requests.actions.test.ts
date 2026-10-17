import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "@/tests/fakeSupabase";

/**
 * Tests for the members' request actions against an in-memory database: the
 * session and membership checks, and what each action leaves behind. The real
 * membership helpers run against the same fake tables; TMDB is mocked.
 * The database functions use state stand-ins here; their transactions are tested in
 * supabase/tests/media_requests.
 */

const ME = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b1";
const THIRD = "00000000-0000-0000-0000-0000000000c1";
const MOVIE = 157336;
const DAY = 24 * 60 * 60 * 1000;

let db: FakeDb;
let addCalls: Record<string, unknown>[];
let signedIn: { id: string; app_metadata?: Record<string, unknown> } | null;
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
    createAdminClient: () => ({
        from: (table: string) => db.from(table),
        rpc: (fn: string, args: Record<string, unknown>) => db.rpc(fn, args),
    }),
}));
vi.mock("@/lib/media/tmdb.server", () => ({ getMovie: getMovieMock }));

import { cancelRequest, keepRequest, requestMovie, unfollowRequest } from "../requests.actions";

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

function setup(rows: { members?: Row[]; requests?: Row[]; followers?: Row[]; users?: Row[] } = {}) {
    db = fakeDb(
        {
            auth_users: rows.users ?? [],
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
            rpc: {
                media_request_add: mediaRequestAdd,
                media_request_cancel: mediaRequestCancel,
                media_request_unfollow: mediaRequestUnfollow,
                media_request_keep: mediaRequestKeep,
            },
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

/** Mirrors public.media_request_add. */
function mediaRequestAdd(args: Record<string, unknown>, tables: Record<string, Row[]>) {
    addCalls.push(args);
    const { p_user, p_media_type, p_tmdb_id, p_weekly_quota } = args;
    const rows = tables.media_request;
    const same = rows.find((r) => r.media_type === p_media_type && r.tmdb_id === p_tmdb_id);
    if (same && same.status !== "cancelled") {
        if (same.status === "available") return "available";
        if (same.status === "failed" || same.status === "declined") return "closed";
        if (same.requested_by === p_user) return "already_requested";
        if (
            tables.media_request_follower.some(
                (f) => f.request_id === same.id && f.user_id === p_user
            )
        ) {
            return "already_following";
        }
        tables.media_request_follower.push(follower(same.id, p_user as string, ago(0)));
        return "followed";
    }
    if (p_weekly_quota !== null) {
        const used = rows.filter(
            (r) =>
                r.requested_by === p_user &&
                r.status !== "cancelled" &&
                Date.parse(r.created_at as string) >= Date.now() - 7 * DAY
        ).length;
        if (used >= (p_weekly_quota as number)) return "quota_exceeded";
    }
    const fresh = {
        requested_by: p_user,
        status: "wanted",
        status_detail: null,
        attempts: 0,
        created_at: new Date().toISOString(),
    };
    if (same) {
        Object.assign(same, fresh);
        tables.media_request_follower = tables.media_request_follower.filter(
            (f) => f.request_id !== same.id || f.user_id !== p_user
        );
        return "reopened";
    }
    rows.push({ id: ++lastId, media_type: p_media_type, tmdb_id: p_tmdb_id, ...fresh });
    return "requested";
}

/** State stand-ins; transaction behavior is tested against Postgres. */
function mediaRequestCancel(args: Record<string, unknown>, tables: Record<string, Row[]>) {
    const { p_user, p_request_id } = args;
    const row = tables.media_request.find((r) => r.id === p_request_id);
    if (
        !row ||
        row.requested_by !== p_user ||
        !["wanted", "proposed"].includes(row.status as string)
    ) {
        return "not_cancellable";
    }
    const eligible = (id: unknown) => {
        const user = tables.auth_users.find((u) => u.id === id);
        const meta = (user?.raw_app_meta_data ?? {}) as { role?: string; roles?: string[] };
        return (
            tables.media_member.some((m) => m.user_id === id && m.revoked_at === null) ||
            meta.role?.toLowerCase() === "admin" ||
            meta.roles?.some((role) => role.toLowerCase() === "admin")
        );
    };
    const next = tables.media_request_follower
        .filter((f) => f.request_id === p_request_id && f.user_id !== p_user && eligible(f.user_id))
        .sort(
            (a, b) =>
                String(a.created_at).localeCompare(String(b.created_at)) ||
                String(a.user_id).localeCompare(String(b.user_id))
        )[0];
    if (!next) {
        row.status = "cancelled";
        return "cancelled";
    }
    row.requested_by = next.user_id;
    tables.media_request_follower = tables.media_request_follower.filter((f) => f !== next);
    return "handed_over";
}

function mediaRequestUnfollow(args: Record<string, unknown>, tables: Record<string, Row[]>) {
    const { p_user, p_request_id } = args;
    const before = tables.media_request_follower.length;
    tables.media_request_follower = tables.media_request_follower.filter(
        (f) => f.request_id !== p_request_id || f.user_id !== p_user
    );
    return tables.media_request_follower.length < before ? "unfollowed" : "changed";
}

/** Mirrors public.media_request_keep. */
function mediaRequestKeep(args: Record<string, unknown>, tables: Record<string, Row[]>) {
    const row = tables.media_request.find((r) => r.id === args.p_request_id);
    if (!row || row.requested_by !== args.p_user || row.remove_after_days == null) return "changed";
    row.remove_after_days = null;
    row.remove_at = null;
    return "kept";
}

const requests = () => db.tables.media_request;
const followers = () => db.tables.media_request_follower;

beforeEach(() => {
    addCalls = [];
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

    it("lets the database check the member's quota as it adds the request", async () => {
        setup({ members: [member(ME, { weekly_quota: 3 })] });
        await requestMovie(MOVIE);

        expect(addCalls).toEqual([
            { p_user: ME, p_media_type: "movie", p_tmdb_id: MOVIE, p_weekly_quota: 3 },
        ]);
    });

    it("passes a trimmed note on, and no note when it's blank", async () => {
        await requestMovie(MOVIE, { note: "  The extended cut \n" });
        await requestMovie(MOVIE, { note: " \n " });
        await requestMovie(MOVIE);

        expect(addCalls[0].p_note).toBe("The extended cut");
        expect(addCalls[1]).not.toHaveProperty("p_note");
        expect(addCalls[2]).not.toHaveProperty("p_note");
    });

    it("asks for removal after the set number of days only when the title is temporary", async () => {
        await requestMovie(MOVIE, { temporary: true });
        await requestMovie(MOVIE, { temporary: false });
        await requestMovie(MOVIE);

        expect(addCalls[0].p_remove_after_days).toBe(30);
        expect(addCalls[1]).not.toHaveProperty("p_remove_after_days");
        expect(addCalls[2]).not.toHaveProperty("p_remove_after_days");
    });

    it.each(["x".repeat(501), 42])("refuses the note %j", async (note) => {
        expect(await requestMovie(MOVIE, { note: note as string })).toEqual({
            ok: false,
            error: "failed",
        });
        expect(addCalls).toHaveLength(0);
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

    it("lets an admin request without a membership row or a quota", async () => {
        signedIn = { id: ME, app_metadata: { roles: ["admin"] } };
        setup({
            members: [member(OTHER)],
            requests: Array.from({ length: 20 }, (_, i) =>
                request({ tmdb_id: 5000 + i, requested_by: ME, created_at: ago(DAY) })
            ),
        });

        expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "requested" });
        expect(requests().find((r) => r.tmdb_id === MOVIE)).toMatchObject({ requested_by: ME });
        expect(addCalls[0].p_weekly_quota).toBeNull();
    });

    it("keeps an admin's access even if a membership row was revoked", async () => {
        signedIn = { id: ME, app_metadata: { role: "admin" } };
        setup({ members: [member(ME, { revoked_at: ago(DAY), weekly_quota: 0 })] });

        expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "requested" });
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
            db.beforeNext("media_request_add", "rpc", () =>
                requests().push(request({ id: 9, requested_by: OTHER, created_at: ago(0) }))
            );

            expect(await requestMovie(MOVIE)).toEqual({ ok: true, outcome: "followed" });
            expect(requests()).toHaveLength(1);
            expect(followers()).toEqual([expect.objectContaining({ request_id: 9, user_id: ME })]);
        });
    });

    it("reports a database error without changing anything", async () => {
        db.failNext("media_request_add", "rpc");

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

    it("hands the request to an admin follower without a membership row", async () => {
        setup({
            members: [member(ME)],
            users: [{ id: OTHER, raw_app_meta_data: { roles: ["ADMIN"] } }],
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, OTHER)],
        });

        expect(await cancelRequest(7)).toEqual({ ok: true, outcome: "handed_over" });
        expect(requests()[0]).toMatchObject({ status: "wanted", requested_by: OTHER });
        expect(followers()).toHaveLength(0);
    });

    it("rechecks cancellation eligibility inside the database write", async () => {
        setup({ requests: [request({ id: 7, requested_by: ME })] });
        db.beforeNext("media_request_cancel", "rpc", () => {
            requests()[0].status = "searching";
        });

        expect(await cancelRequest(7)).toEqual({ ok: false, error: "not_cancellable" });
        expect(requests()[0].status).toBe("searching");
    });

    it("reports a handover transaction failure without changing ownership", async () => {
        setup({
            requests: [request({ id: 7, requested_by: ME })],
            followers: [follower(7, OTHER)],
        });
        db.failNext("media_request_cancel", "rpc");

        expect(await cancelRequest(7)).toEqual({ ok: false, error: "failed" });
        expect(requests()[0].requested_by).toBe(ME);
        expect(followers()).toHaveLength(1);
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

describe("keepRequest", () => {
    it("keeps your temporary title", async () => {
        setup({ requests: [request({ id: 7, requested_by: ME, remove_after_days: 30 })] });

        expect(await keepRequest(7)).toEqual({ ok: true, outcome: "kept" });
        expect(requests()[0].remove_after_days).toBeNull();
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("shows the current state when there's nothing to keep", async () => {
        setup({ requests: [request({ id: 7, requested_by: OTHER, remove_after_days: 30 })] });

        expect(await keepRequest(7)).toEqual({ ok: false, error: "changed" });
        expect(requests()[0].remove_after_days).toBe(30);
        expect(refreshMock).toHaveBeenCalledOnce();
    });

    it("refuses someone without access", async () => {
        signedIn = null;
        setup({ requests: [request({ id: 7, requested_by: ME, remove_after_days: 30 })] });

        expect(await keepRequest(7)).toEqual({ ok: false, error: "not_member" });
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
