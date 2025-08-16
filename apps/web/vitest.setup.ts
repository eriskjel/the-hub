import "@testing-library/jest-dom";
import { vi } from "vitest";

/** ---------- next-intl (namespace-aware, tiny) ---------- */
let __intlLocale = "en";
let __intlMessages: Record<string, any> = {};

const getPath = (obj: any, path: string) =>
    path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);

vi.mock("next-intl", () => ({
    useLocale: () => __intlLocale,
    useTranslations: (ns?: string) => (key: string, params?: Record<string, string>) => {
        const full = ns ? `${ns}.${key}` : key;
        const val = getPath(__intlMessages, full);
        if (typeof val === "string") {
            return val.replace(/\{(\w+)\}/g, (_, k) => params?.[k] ?? `{${k}}`);
        }
        // Fallback to readable key path; keeps tests stable even if messages missing
        return full;
    },
}));

/** ---------- next/navigation (search params only) ---------- */
let __search = new URLSearchParams("");

vi.mock("next/navigation", () => ({
    useSearchParams: () => __search,
}));

/** ---------- helpers exposed to tests ---------- */
(globalThis as any).__setIntl = (opts: { locale?: string; messages?: Record<string, any> }) => {
    if (opts.locale) __intlLocale = opts.locale;
    if (opts.messages) __intlMessages = opts.messages;
};
(globalThis as any).__setSearch = (query: string) => {
    __search = new URLSearchParams(query);
};
