export function safeNextPath(next: string) {
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
