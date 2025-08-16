export function getOrigin(url: URL): string {
    const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (envOrigin) {
        // must be absolute http/https URL
        try {
            const u = new URL(envOrigin);
            if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
        } catch {/* fall through */}
        throw new Error("Invalid NEXT_PUBLIC_SITE_URL (must be absolute http/https URL)");
    }

    // Dev fallback: trust the request origin only in development
    if (process.env.NODE_ENV === "development") {
        return url.origin;
    }

    // In prod with no env variable → fail fast (don’t guess)
    throw new Error("Server misconfiguration: set NEXT_PUBLIC_SITE_URL");
}