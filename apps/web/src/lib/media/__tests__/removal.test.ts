import { expect, it } from "vitest";
import { describeRemoval } from "../removal";

const t = (key: string, values: Record<string, string>) => `${key} ${JSON.stringify(values)}`;
const removal = { days: 30, at: "2026-11-15T23:30:00Z" };

it("shows an admin deadline even when several users follow the title", () => {
    expect(
        describeRemoval(
            {
                status: "available",
                removal,
                followerCount: 3,
                retention: { policy: "remove", days: 30, by: "Erik", eligible: true },
            },
            t,
            "en"
        )
    ).toBe('adminRemovalDate {"name":"Erik","date":"16 Nov 2026"}');
});

it("shows the admin keep decision and distinguishes protected releases", () => {
    expect(
        describeRemoval(
            {
                status: "available",
                removal: null,
                followerCount: 0,
                retention: { policy: "keep", days: null, by: "Erik", eligible: true },
            },
            t,
            "en"
        )
    ).toBe('adminKeep {"name":"Erik"}');
    expect(
        describeRemoval(
            {
                status: "wanted",
                removal: null,
                followerCount: 0,
                retention: { policy: "keep", days: null, by: null, eligible: null },
            },
            t,
            "en"
        )
    ).toBe('adminKeep {"name":"anAdmin {}"}');
    expect(
        describeRemoval(
            {
                status: "available",
                removal,
                followerCount: 0,
                retention: { policy: "remove", days: 30, by: "Erik", eligible: false },
            },
            t,
            "en"
        )
    ).toBe('adminRemovalProtected {"name":"Erik"}');
});

it("says how long a temporary title stays while it's still wanted", () => {
    expect(describeRemoval({ status: "wanted", removal, followerCount: 0 }, t, "en")).toBe(
        'removalPending {"days":"30"}'
    );
});

it("gives the scheduled date in Oslo time once the title is in the library", () => {
    const item = { status: "available" as const, removal, followerCount: 0 };
    expect(describeRemoval(item, t, "en")).toBe('removalDate {"date":"16 Nov"}');
    expect(describeRemoval(item, t, "no")).toBe('removalDate {"date":"16. nov."}');
});

it.each([
    ["it isn't temporary", { status: "available", removal: null, followerCount: 0 }],
    ["someone +1'd it", { status: "available", removal, followerCount: 1 }],
    ["someone +1'd it while it's wanted", { status: "wanted", removal, followerCount: 2 }],
    [
        "the worker never scheduled it",
        { status: "available", removal: { days: 30, at: null }, followerCount: 0 },
    ],
    ["it's already gone", { status: "removed", removal, followerCount: 0 }],
] as const)("says nothing when %s", (_label, item) => {
    expect(describeRemoval(item, t, "en")).toBeNull();
});
