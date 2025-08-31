import { NextRequest, NextResponse } from "next/server";
import { isAbortError } from "@/utils/http";

export const dynamic = "force-dynamic";

const GEOCODE_TIMEOUT_MS = 10_000 as const;

export async function GET(req: NextRequest) {
    const lat = req.nextUrl.searchParams.get("lat");
    const lon = req.nextUrl.searchParams.get("lon");
    const zoom = req.nextUrl.searchParams.get("zoom") ?? "10"; // ~ city/town level

    if (!lat || !lon) {
        return NextResponse.json({ error: "Missing lat/lon" }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", zoom);
    url.searchParams.set("addressdetails", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

    try {
        const res = await fetch(url.toString(), {
            headers: { "User-Agent": "the-hub/1.0 reverse-geocode" },
            cache: "no-store",
            signal: controller.signal,
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Reverse geocoder failed: ${res.status}` },
                { status: 502 }
            );
        }

        const data = (await res.json()) as {
            display_name?: string;
            address?: Record<string, string>;
        };

        const a = data.address ?? {};
        const city =
            a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.county;

        return NextResponse.json({
            city: city ?? null,
            displayName: data.display_name ?? null,
        });
    } catch (err: unknown) {
        if (isAbortError(err))
            return NextResponse.json({ error: "Reverse geocoder timed out" }, { status: 504 });
        return NextResponse.json({ error: "Reverse geocoder request failed" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
