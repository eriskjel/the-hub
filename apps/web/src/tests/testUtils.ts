import type { Mock } from "vitest";
import { NextRequest } from "next/server";

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

// Create a type that includes your global extensions
type GlobalWithMocks = typeof globalThis & {
    __setIntl?: (opts: { locale?: string; messages?: Record<string, unknown> }) => void;
    __setSearch?: (query: string) => void;
    __setPathname?: (path: string) => void;
    __getReplaceMock?: () => Mock;
    __getRedirectMock?: () => Mock & ((url: string) => never);
    __getRevalidatePathMock?: () => Mock;
    __supabase?: NonNullable<typeof globalThis.__supabase>;
};

const global = globalThis as GlobalWithMocks;

export const mkReq = (url: string): NextRequest => new NextRequest(url);

export function setIntl(opts: { locale?: string; messages?: Record<string, unknown> }) {
    global.__setIntl?.(opts);
}

export function setSearch(query: string) {
    global.__setSearch?.(query);
}

export function setPathname(path: string) {
    global.__setPathname?.(path);
}

export function getReplaceMock(): Mock {
    return global.__getReplaceMock?.() as Mock;
}

export function getRevalidatePathMock(): Mock {
    return global.__getRevalidatePathMock?.() as Mock;
}

type SupabaseMocksShape = NonNullable<typeof globalThis.__supabase>;
export function supabase(): SupabaseMocksShape {
    return global.__supabase as SupabaseMocksShape;
}

export function getRedirectMock(): Mock {
    return global.__getRedirectMock?.() as Mock;
}
