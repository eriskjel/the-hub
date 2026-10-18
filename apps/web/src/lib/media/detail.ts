import { z } from "zod";
import { dateLocale } from "@/i18n/format";
import type { RequestStatus } from "./request";

const value = z.string().min(1).max(300);
// Zod strips extra fields so services can extend a message without breaking readers.
const empty = z.object({});
const label = z.object({ label: value });
const group = z.object({ group: value });
const next = z.object({ next: value });

/** The database accepts future codes; only this registry decides what members see. */
export const DETAIL_CODES = {
    paused: { member: true, args: empty },
    waiting_release: {
        member: true,
        args: z.object({ date: value }),
        date: { field: "date", kind: "calendar" },
    },
    no_releases: { member: true, args: next, date: { field: "next", kind: "timestamp" } },
    only_low_quality: { member: true, args: next, date: { field: "next", kind: "timestamp" } },
    unwanted: { member: true, args: empty },
    search_failed: { member: true, args: empty },
    in_library: { member: true, args: z.object({ release: value }) },
    suggested: { member: false, args: label },
    choice_no_listed_remux: { member: false, args: empty },
    choice_4k_missing: { member: false, args: empty },
    choice_cuts: { member: false, args: z.object({ group: value, cuts: value }) },
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

const osloYear = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "numeric" });
// At most two locales × two date styles × with/without year.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatDate(date: Date, kind: "calendar" | "timestamp", locale: string, now: Date): string {
    const calendar = kind === "calendar";
    const year = calendar ? String(date.getUTCFullYear()) : osloYear.format(date);
    const showYear = year !== osloYear.format(now);
    const language = dateLocale(locale);
    const key = `${language}:${kind}:${showYear}`;
    let formatter = dateFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(language, {
            timeZone: calendar ? "UTC" : "Europe/Oslo",
            day: "numeric",
            month: "short",
            ...(!calendar && { weekday: "short" }),
            ...(showYear && { year: "numeric" }),
        });
        dateFormatters.set(key, formatter);
    }
    return formatter.format(date);
}

export function calendarDate(value: string): Date | null {
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
    audience: "member" | "admin",
    now: Date = new Date()
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
    if ("date" in definition) {
        const { field, kind } = definition.date;
        const date = kind === "calendar" ? calendarDate(values[field]) : timestamp(values[field]);
        if (!date) return item.statusDetail;
        values[field] = formatDate(date, kind, locale, now);
    }

    const text = t(key, values);
    return key === "in_library" && audience === "admin" ? `${text}: ${values.release}` : text;
}
