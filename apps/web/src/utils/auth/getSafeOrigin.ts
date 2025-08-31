export function getSafeOrigin(url: URL): string {
    const isDev = process.env.NODE_ENV === "development";

    // In dev: always trust the incoming request origin
    if (isDev) return url.origin;

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
