import type { Mock } from "vitest";

declare global {
    var __setIntl:
        | ((opts: { locale?: string; messages?: Record<string, unknown> }) => void)
        | undefined;
    var __setSearch: ((query: string) => void) | undefined;
    var __setPathname: ((path: string) => void) | undefined;
    var __getReplaceMock: (() => Mock) | undefined;

    var __getRedirectMock: (() => Mock & ((url: string) => never)) | undefined;
    var __getRevalidatePathMock: (() => Mock) | undefined;

    var __supabase:
        | {
              setAuthHandlers: (handlers: {
                  signUp?: (args: {
                      email: string;
                      password: string;
                      options?: { data?: { name?: string } };
                  }) => Promise<{ data?: unknown; error?: unknown }>;
                  signInWithPassword?: (args: {
                      email: string;
                      password: string;
                  }) => Promise<{ data?: unknown; error?: unknown }>;
                  signOut?: () => Promise<{ error?: unknown }>;
                  getUser?: () => Promise<{ data: { user: unknown | null }; error?: unknown }>;
              }) => void;
              seedTable: (table: string, data: unknown) => void;
              resetTables: () => void;
              getMocks: () => {
                  redirect: Mock;
                  revalidatePath: Mock;
              };
          }
        | undefined;
}

export function mkReq(url: string) {
    return { url, nextUrl: new URL(url) };
}
export function setIntl(opts: { locale?: string; messages?: Record<string, unknown> }) {
    globalThis.__setIntl?.(opts);
}
export function setSearch(query: string) {
    globalThis.__setSearch?.(query);
}
export function setPathname(path: string) {
    globalThis.__setPathname?.(path);
}
export function getReplaceMock(): Mock {
    return globalThis.__getReplaceMock?.() as Mock;
}

export function getRevalidatePathMock(): Mock {
    return globalThis.__getRevalidatePathMock?.() as Mock;
}

type SupabaseMocksShape = NonNullable<typeof globalThis.__supabase>;
export function supabase(): SupabaseMocksShape {
    return globalThis.__supabase as SupabaseMocksShape;
}

export function getRedirectMock(): Mock {
    return (globalThis as any).__getRedirectMock?.() as Mock;
}
