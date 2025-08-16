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
        return full;
    },
}));

/** ---------- next/navigation (EXPANDED) ---------- */
let __search = new URLSearchParams("");
let __pathname = "/";
let __replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
    useSearchParams: () => __search,
    usePathname: () => __pathname,
    useRouter: () => ({ replace: __replaceMock }),
}));

/** ---------- helpers exposed to tests ---------- */
(globalThis as any).__setIntl = (opts: { locale?: string; messages?: Record<string, any> }) => {
    if (opts.locale) __intlLocale = opts.locale;
    if (opts.messages) __intlMessages = opts.messages;
};

(globalThis as any).__setSearch = (query: string) => {
    __search = new URLSearchParams(query);
};

(globalThis as any).__setPathname = (path: string) => {
    __pathname = path;
};

(globalThis as any).__getReplaceMock = () => __replaceMock;
