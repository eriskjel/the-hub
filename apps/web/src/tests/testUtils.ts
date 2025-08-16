export function mkReq(url: string): any {
    return { url, nextUrl: new URL(url) };
}

export function setIntl(opts: { locale?: string; messages?: Record<string, any> }) {
    (globalThis as any).__setIntl?.(opts);
}

export function setSearch(query: string) {
    (globalThis as any).__setSearch?.(query);
}
