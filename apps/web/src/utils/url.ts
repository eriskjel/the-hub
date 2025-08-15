export function getBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SITE_URL;
    if (!url) {
        // Fail loudly in client
        throw new Error("NEXT_PUBLIC_SITE_URL is required");
    }
    return url.endsWith("/") ? url : `${url}/`;
}
