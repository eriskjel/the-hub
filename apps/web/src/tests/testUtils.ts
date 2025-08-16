declare global {
    var __setIntl:
        | ((opts: { locale?: string; messages?: Record<string, unknown> }) => void)
        | undefined;
    var __setSearch: ((query: string) => void) | undefined;
    var __setPathname: ((path: string) => void) | undefined;
    var __getReplaceMock: (() => unknown) | undefined;
}

// Define the type for mock Next.js request objects
interface MockNextRequest {
    url: string;
    nextUrl: URL;
}

export function mkReq(url: string): MockNextRequest {
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

export function getReplaceMock() {
    return globalThis.__getReplaceMock?.();
}
