/**
 * Env used by auth routes (callback, confirm) via getSafeOrigin.
 * CI sets this; locally it is often unset, so we default for tests.
 */
if (!process.env.NEXT_PUBLIC_SITE_URL) {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
}

import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";

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

/** ---------- next/navigation (ONE merged mock) ---------- */
let __search = new URLSearchParams("");
let __pathname = "/";
const __replaceMock = vi.fn();
const __redirectMock = vi.fn((url: string) => {
    const err: any = new Error(`REDIRECT:${url}`);
    err.__isRedirect = true;
    throw err; // simulate Next redirect behavior
});

vi.mock("next/navigation", () => ({
    useSearchParams: () => __search,
    usePathname: () => __pathname,
    useRouter: () => ({ replace: __replaceMock }),
    redirect: __redirectMock,
}));

/** ---------- next/cache ---------- */
const __revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
    revalidatePath: __revalidatePathMock,
}));

/** ---------- Supabase server client (createClient) ---------- */
type Row = Record<string, any>;
type TableData = Record<string, Row | Row[] | null>;

let __supabaseAuth: {
    signUp?: (args: any) => Promise<{ data?: any; error?: any }>;
    signInWithPassword?: (args: any) => Promise<{ data?: any; error?: any }>;
    signOut?: () => Promise<{ error?: any }>;
    getUser?: () => Promise<{ data: { user: any | null }; error?: any }>;
} = {};

let __tables: Record<string, TableData> = {};

function makeQuery(table: string) {
    const state = { filters: {} as Record<string, any> };
    const qb = {
        select: vi.fn(() => qb),
        eq: vi.fn((k: string, v: any) => {
            state.filters[k] = v;
            return qb;
        }),
        single: vi.fn(async <T = any>() => {
            const data = __tables[table]?.data ?? null;
            let row: any = null;
            if (Array.isArray(data)) {
                row =
                    data.find((r) =>
                        Object.entries(state.filters).every(([k, v]) => r?.[k] === v)
                    ) ?? null;
            } else if (data && typeof data === "object") {
                row = Object.entries(state.filters).every(([k, v]) => (data as any)[k] === v)
                    ? data
                    : null;
            }
            return { data: (row ?? null) as T, error: null };
        }),
        insert: vi.fn(async (payload: any) => {
            const current = __tables[table]?.data;
            if (Array.isArray(current)) {
                current.push(payload);
                __tables[table]!.data = current;
            } else {
                __tables[table] = { data: [payload] };
            }
            return { data: payload, error: null };
        }),
        upsert: vi.fn(async (payload: any) => {
            const current = __tables[table]?.data;
            if (!Array.isArray(current)) {
                __tables[table] = { data: [payload] };
            } else {
                const idx = current.findIndex((r) => r.id && r.id === payload.id);
                if (idx >= 0) current[idx] = { ...current[idx], ...payload };
                else current.push(payload);
            }
            return { data: payload, error: null };
        }),
    };
    return qb;
}

const __createClientMock = () => ({
    auth: {
        signUp: vi.fn((args) =>
            __supabaseAuth.signUp
                ? __supabaseAuth.signUp(args)
                : Promise.resolve({ data: {}, error: null })
        ),
        signInWithPassword: vi.fn((args) =>
            __supabaseAuth.signInWithPassword
                ? __supabaseAuth.signInWithPassword(args)
                : Promise.resolve({ data: {}, error: null })
        ),
        signOut: vi.fn(() =>
            __supabaseAuth.signOut ? __supabaseAuth.signOut() : Promise.resolve({ error: null })
        ),
        getUser: vi.fn(() =>
            __supabaseAuth.getUser
                ? __supabaseAuth.getUser()
                : Promise.resolve({ data: { user: null }, error: null })
        ),
    },
    from: vi.fn((table: string) => makeQuery(table)),
});

vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => __createClientMock(),
}));

/** ---------- expose helpers to tests ---------- */
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
(globalThis as any).__getRedirectMock = () => __redirectMock;
(globalThis as any).__getRevalidatePathMock = () => __revalidatePathMock;

(globalThis as any).__supabase = {
    setAuthHandlers: (handlers: Partial<typeof __supabaseAuth>) => {
        __supabaseAuth = { ...__supabaseAuth, ...handlers };
    },
    seedTable: (table: string, data: Row | Row[] | null) => {
        __tables[table] = { data: Array.isArray(data) ? data.slice() : data ? { ...data } : null };
    },
    resetTables: () => {
        __tables = {};
    },
    getMocks: () => ({
        redirect: (globalThis as any).__getRedirectMock?.(),
        revalidatePath: (globalThis as any).__getRevalidatePathMock?.(),
    }),
};

/** ---------- cleanup ---------- */
afterEach(() => {
    __replaceMock.mockClear();
    __redirectMock.mockClear();
    __revalidatePathMock.mockClear();

    (globalThis as any).__setSearch?.("");
    (globalThis as any).__setPathname?.("/");
    (globalThis as any).__setIntl?.({ locale: "en", messages: {} });

    (globalThis as any).__supabase.resetTables();
    (globalThis as any).__supabase.setAuthHandlers({});
});
