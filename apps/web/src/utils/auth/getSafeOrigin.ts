/**
 * Validates that a host is safe for local development (localhost/127.0.0.1 only)
 * This prevents Host header injection attacks
 */
function isValidDevHost(host: string): boolean {
    if (!host) return false;
    // Remove port if present
    const hostname = host.split(":")[0].toLowerCase();
    // Only allow localhost variants and 127.0.0.1
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]" ||
        hostname.startsWith("127.") // Allow 127.x.x.x for local development
    );
}

export function getSafeOrigin(url: URL, hostHeader?: string | null): string {
    const isDev = process.env.NODE_ENV === "development";

    // In dev: use Host header if available (fixes Docker 0.0.0.0 issue), otherwise fall back to url.origin
    if (isDev) {
        if (hostHeader && isValidDevHost(hostHeader)) {
            // Use the Host header which has the actual hostname the browser is using
            // But only if it's a safe localhost variant (prevents Host header injection)
            const protocol = url.protocol || "http:";
            return `${protocol}//${hostHeader}`;
        }
        // Fallback: if origin is 0.0.0.0, replace with localhost
        if (url.hostname === "0.0.0.0") {
            return url.origin.replace("0.0.0.0", "localhost");
        }
        // Validate the URL's hostname as well
        if (url.hostname && !isValidDevHost(url.hostname)) {
            // In dev, if we get an unexpected hostname, default to localhost
            return url.origin.replace(url.hostname, "localhost");
        }
        return url.origin;
    }

    // In prod: require a configured absolute http/https origin
    const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!envOrigin) {
        throw new Error("Server misconfiguration: set NEXT_PUBLIC_SITE_URL in production");
    }
    let u: URL;
    try {
        u = new URL(envOrigin);
    } catch {
        throw new Error("Invalid NEXT_PUBLIC_SITE_URL (must be absolute http/https URL)");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("NEXT_PUBLIC_SITE_URL must use http/https");
    }
    return u.origin;
}
