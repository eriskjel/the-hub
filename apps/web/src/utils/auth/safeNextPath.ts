export function safeNextPath(next: string): string {
    try {
        next = decodeURIComponent(next);
    } catch {
        return "/";
    }
    if (
        next.startsWith("/") &&
        !next.startsWith("//") &&
        next.indexOf(":") === -1 &&
        next.indexOf("\\") === -1 &&
        // Prevent control character injection attacks by rejecting any path containing ASCII control characters.
        !/[\x00-\x1F\x7F]/.test(next)
    ) {
        return next;
    }
    return "/";
}
