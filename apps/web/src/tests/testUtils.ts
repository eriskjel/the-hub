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
                  signUp?: (args: any) => Promise<{ data?: any; error?: any }>;
                  signInWithPassword?: (args: any) => Promise<{ data?: any; error?: any }>;
                  signOut?: () => Promise<{ error?: any }>;
                  getUser?: () => Promise<{ data: { user: any | null }; error?: any }>;
              }) => void;
              seedTable: (table: string, data: any) => void;
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
    return globalThis.__getReplaceMock?.() as unknown as Mock;
}
