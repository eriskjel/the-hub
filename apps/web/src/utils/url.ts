import { headers } from "next/headers";
import { getSafeOrigin } from "@/utils/auth/getSafeOrigin";

export async function resolveOrigin(): Promise<string> {
    const h = await headers();
    const proto =
        h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Cannot resolve request host");

    // Build a URL to satisfy getSafeOrigin’s signature
    return getSafeOrigin(new URL(`${proto}://${host}`), host);
}
