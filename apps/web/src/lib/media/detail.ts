import { z } from "zod";
import type { RequestStatus } from "./request";

const value = z.string().min(1).max(300);
const empty = z.object({}).strict();
const label = z.object({ label: value }).strict();
const group = z.object({ group: value }).strict();
const next = z.object({ next: value }).strict();

/** The database accepts future codes; only this registry decides what members see. */
export const DETAIL_CODES = {
    paused: { member: true, args: empty },
    waiting_release: { member: true, args: z.object({ date: value }).strict() },
    no_releases: { member: true, args: next },
    only_low_quality: { member: true, args: next },
    unwanted: { member: true, args: empty },
    search_failed: { member: true, args: empty },
    in_library: { member: true, args: z.object({ release: value }).strict() },
    suggested: { member: false, args: label },
    choice_no_listed_remux: { member: false, args: empty },
    choice_4k_missing: { member: false, args: empty },
    choice_cuts: { member: false, args: z.object({ group: value, cuts: value }).strict() },
    choice_ambiguous: { member: false, args: group },
    choice_sizes: { member: false, args: group },
    release: { member: true, args: label },
    not_cached: { member: false, args: label },
    choice_unmatched: { member: false, args: empty },
    no_longer_wanted: { member: false, args: empty },
    add_failed: { member: true, args: empty },
} as const;

export type DetailCode = keyof typeof DETAIL_CODES;
export type RequestDetail = { code: string; args: unknown };
type Translate = (key: DetailCode, values?: Record<string, string>) => string;

function calendarDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
        ? date
        : null;
}

function timestamp(value: string): Date | null {
    if (
        !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
            value
        )
    ) {
        return null;
    }
    if (!calendarDate(value.slice(0, 10))) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

/** Returns plain text for React to escape. Hidden details never use the fallback. */
export function describeDetail(
    item: { status: RequestStatus; statusDetail: string | null; detail: RequestDetail | null },
    t: Translate,
    locale: string,
    audience: "member" | "admin"
): string | null {
    if (audience === "member" && item.status === "proposed") return null;
    if (!item.detail) return item.statusDetail;

    const { code, args } = item.detail;
    if (!Object.hasOwn(DETAIL_CODES, code)) {
        return audience === "admin" ? item.statusDetail : null;
    }
    const key = code as DetailCode;
    const definition = DETAIL_CODES[key];
    if (audience === "member" && !definition.member) return null;
    const parsed = definition.args.safeParse(args);
    if (!parsed.success) return item.statusDetail;
    const values: Record<string, string> = { ...parsed.data };
    const language = locale === "no" ? "nb-NO" : "en-GB";

    if (key === "waiting_release" || key === "no_releases" || key === "only_low_quality") {
        const isRelease = key === "waiting_release";
        const name = isRelease ? "date" : "next";
        const date = isRelease ? calendarDate(values[name]) : timestamp(values[name]);
        if (!date) return item.statusDetail;
        values[name] = new Intl.DateTimeFormat(language, {
            timeZone: isRelease ? "UTC" : "Europe/Oslo",
            day: "numeric",
            month: "short",
            ...(!isRelease && { weekday: "short" }),
        }).format(date);
    }

    const text = t(key, values);
    return key === "in_library" && audience === "admin" ? `${text}: ${values.release}` : text;
}
