export function getSafeOrigin(url: URL): string {
    const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (envOrigin) {
        let u: URL;
        try {
            u = new URL(envOrigin);
        } catch {
            throw new Error("Invalid NEXT_PUBLIC_SITE_URL (must be absolute http/https URL)");
        }
        if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
        throw new Error("NEXT_PUBLIC_SITE_URL must use http/https");
    }

    if (process.env.NODE_ENV === "development") return url.origin;
    throw new Error("Server misconfiguration: set NEXT_PUBLIC_SITE_URL");
}
