import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { vi } from "vitest";
import en from "@/messages/en.json";
import no from "@/messages/no.json";
import { describeDetail, DETAIL_CODES, type DetailCode } from "../detail";

vi.unmock("next-intl");

const examples: Record<DetailCode, Record<string, string>> = {
    paused: {},
    waiting_release: { date: "2026-11-12" },
    no_releases: { next: "2026-10-17T12:00:00Z" },
    only_low_quality: { next: "2026-10-17T12:00:00Z" },
    unwanted: {},
    search_failed: {},
    in_library: { release: "Film.2026.REMUX-Group" },
    suggested: { label: "Group · 2160p remux" },
    choice_no_listed_remux: {},
    choice_4k_missing: {},
    choice_cuts: { group: "Group", cuts: "Theatrical, Director's Cut" },
    choice_ambiguous: { group: "Group" },
    choice_sizes: { group: "Group" },
    release: { label: "Group · 2160p remux" },
    not_cached: { label: "Group · 2160p remux" },
    choice_unmatched: {},
    no_longer_wanted: {},
    add_failed: {},
};

function render(
    code: string | null,
    args: unknown,
    audience: "member" | "admin" = "admin",
    locale = "no",
    status: "wanted" | "proposed" | "available" = "wanted"
) {
    const t = createTranslator({
        locale,
        messages: locale === "no" ? no : en,
        namespace: "requests.detail",
        onError: (error) => {
            throw error;
        },
    });
    return describeDetail(
        { status, statusDetail: "Legacy English", detail: code === null ? null : { code, args } },
        t,
        locale,
        audience
    );
}

describe.each(["no", "en"])("request details in %s", (locale) => {
    it.each(Object.keys(examples) as DetailCode[])(
        "renders %s using the real translation engine",
        (code) => {
            const result = render(code, examples[code], "admin", locale);
            expect(result).toBeTruthy();
            expect(result).not.toBe("Legacy English");
            expect(result).not.toContain("requests.detail.");
            expect(result).not.toMatch(/\{\w+\}/);
        }
    );
    it("keeps labels and cuts literal, including apostrophes and markup", () => {
        const label = "<b>{date}</b> Director's Cut";
        expect(render("release", { label }, "member", locale)).toBe(label);
        expect(render("choice_cuts", examples.choice_cuts, "admin", locale)).toContain(
            "Director's Cut"
        );
    });
});

it("formats calendar dates and next checks in the reader's language", () => {
    expect(render("waiting_release", examples.waiting_release)).toBe(
        "Venter på digital utgivelse 12. nov."
    );
    expect(render("no_releases", examples.no_releases)).toBe(
        "Ingen utgivelser ennå, sjekker igjen lør. 17. okt."
    );
    expect(render("no_releases", examples.no_releases, "admin", "en")).toBe(
        "No releases yet, checking again Sat 17 Oct"
    );
});

it.each([
    ["2026-10-16T22:30:00Z", "lør. 17. okt."],
    ["2026-01-01T23:30:00Z", "fre. 2. jan."],
    ["2026-03-28T23:30:00Z", "søn. 29. mars"],
    ["2026-10-25T23:30:00Z", "man. 26. okt."],
])("uses Oslo dates across midnight and DST: %s", (next, expected) => {
    expect(render("no_releases", { next })).toContain(expected);
});

it.each([
    null,
    [],
    "label",
    {},
    { label: 42 },
    { label: "" },
    { label: "x".repeat(301) },
    { label: "ok", extra: "unexpected" },
])("falls back on malformed arguments: %j", (args) => {
    expect(render("release", args, "member")).toBe("Legacy English");
});

it.each(["2026-02-30", "2026-13-01", "tomorrow", "2026-11-12T00:00:00Z"])(
    "rejects invalid calendar date %s",
    (date) => {
        expect(render("waiting_release", { date })).toBe("Legacy English");
    }
);

it.each([
    "2026-10-17",
    "2026-10-17T12:00:00",
    "2026-02-30T12:00:00Z",
    "2026-10-17T24:00:00Z",
    "garbage",
])("rejects ambiguous or invalid timestamp %s", (next) => {
    expect(render("no_releases", { next })).toBe("Legacy English");
});

it("uses legacy text for uncoded rows, but never for member proposals", () => {
    expect(render(null, null, "member")).toBe("Legacy English");
    expect(render(null, null, "member", "no", "proposed")).toBeNull();
});

it.each(["future_code", "constructor", "__proto__"])(
    "falls back for admins and hides unknown code %s for members",
    (code) => {
        expect(render(code, {}, "admin")).toBe("Legacy English");
        expect(render(code, {}, "member")).toBeNull();
    }
);

it.each((Object.keys(examples) as DetailCode[]).filter((code) => !DETAIL_CODES[code].member))(
    "never exposes %s or its fallback to members",
    (code) => {
        expect(render(code, examples[code], "member")).toBeNull();
        expect(render(code, null, "member")).toBeNull();
    }
);

it("hides an unconfirmed library match from members and gives admins the raw release name", () => {
    expect(render("in_library", examples.in_library, "member", "no", "proposed")).toBeNull();
    expect(render("in_library", examples.in_library, "member", "no", "available")).toBe(
        "Fantes allerede i biblioteket"
    );
    expect(render("in_library", examples.in_library)).toBe(
        "Fantes allerede i biblioteket: Film.2026.REMUX-Group"
    );
});
