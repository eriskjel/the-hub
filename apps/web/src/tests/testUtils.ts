// Define the types for custom global test helpers
declare global {
    var __setIntl:
        | ((opts: { locale?: string; messages?: Record<string, unknown> }) => void)
        | undefined;
    var __setSearch: ((query: string) => void) | undefined;
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
