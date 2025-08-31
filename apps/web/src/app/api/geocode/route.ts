import { NextRequest, NextResponse } from "next/server";
import { isAbortError } from "@/utils/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const city = req.nextUrl.searchParams.get("city")?.trim();
    if (!city) return NextResponse.json({ error: "Missing ?city" }, { status: 400 });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", city);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const res = await fetch(url.toString(), {
            headers: { "User-Agent": "the-hub/1.0 geocode" },
            cache: "no-store",
            signal: controller.signal,
        });

        if (!res.ok)
            return NextResponse.json({ error: `Geocoder failed: ${res.status}` }, { status: 502 });

        const data = (await res.json()) as Array<{
            lat: string;
            lon: string;
            display_name?: string;
        }>;
        if (!data?.length) return NextResponse.json({ error: "No results" }, { status: 404 });

        const top = data[0];
        return NextResponse.json({
            lat: Number(top.lat),
            lon: Number(top.lon),
            displayName: top.display_name ?? city,
        });
    } catch (err: unknown) {
        if (isAbortError(err))
            return NextResponse.json({ error: "Geocoder timed out" }, { status: 504 });
        return NextResponse.json({ error: "Geocoder request failed" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
