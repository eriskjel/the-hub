export function safeNextPath(next: string): string {
    // decode once; if decoding fails, bail out
    try {
        next = decodeURIComponent(next);
    } catch {
        return "/";
    }

    // only allow absolute-paths:
    // - must start with exactly one slash
    // - no protocol-relative (//)
    // - no colon (blocks "scheme:path" and encoded variants)
    // - no backslashes
    // - no control chars
    if (
        next.startsWith("/") &&
        !next.startsWith("//") &&
        next.indexOf(":") === -1 &&
        next.indexOf("\\") === -1 &&
        !/[\x00-\x1F\x7F]/.test(next)
    ) {
        return next;
    }

    return "/";
}
