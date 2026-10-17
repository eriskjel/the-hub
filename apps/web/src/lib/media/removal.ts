import { dateLocale } from "@/i18n/format";
import { isOpenStatus, type RequestStatus } from "./request";

type Translate = (key: "removalPending" | "removalDate", values: Record<string, string>) => string;

/**
 * Whether a temporary title is still due to leave: it's wanted, or the worker
 * added it and dated the removal. One the worker didn't add stays for good.
 */
export function removalAhead(
    status: RequestStatus,
    removal: { at: string | null } | null | undefined
): boolean {
    return !!removal && (isOpenStatus(status) || (status === "available" && !!removal.at));
}

/**
 * When a temporary title leaves the library, as plain text. Null when it
 * stays: it isn't temporary, someone +1'd it, or the worker didn't add it
 * itself and so never schedules it.
 */
export function describeRemoval(
    item: {
        status: RequestStatus;
        removal: { days: number; at: string | null } | null;
        followerCount: number;
    },
    t: Translate,
    locale: string
): string | null {
    const { removal } = item;
    if (!removal || item.followerCount > 0 || !removalAhead(item.status, removal)) return null;
    if (isOpenStatus(item.status) || !removal.at) {
        return t("removalPending", { days: String(removal.days) });
    }
    const date = new Intl.DateTimeFormat(dateLocale(locale), {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Oslo",
    }).format(new Date(removal.at));
    return t("removalDate", { date });
}
