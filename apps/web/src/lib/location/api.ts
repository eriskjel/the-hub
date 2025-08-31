import { GeocodeResult, HttpError, ReverseGeocodeResult } from "@/lib/location/types";

export async function geocodeCity(q: string, signal?: AbortSignal): Promise<GeocodeResult> {
    const res = await fetch(`/api/geocode?city=${encodeURIComponent(q)}`, { signal });
    if (!res.ok) throw new HttpError(res.status, `geocode failed: ${res.status}`);
    return res.json();
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}&zoom=10`);
    if (!res.ok) throw new HttpError(res.status, `reverse geocode failed: ${res.status}`);
    return res.json();
}
