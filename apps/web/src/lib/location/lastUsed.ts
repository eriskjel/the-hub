const STORAGE_KEY = "hub_grocery_location_v1";

export type LastUsedLocation = {
    city: string;
    lat: number;
    lon: number;
};

export function saveLastUsedLocation(loc: LastUsedLocation): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
        // ignore (SSR, private browsing, storage quota)
    }
}

export function loadLastUsedLocation(): LastUsedLocation | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (
            typeof p?.city === "string" &&
            typeof p?.lat === "number" &&
            typeof p?.lon === "number"
        ) {
            return { city: p.city, lat: p.lat, lon: p.lon };
        }
    } catch {
        // ignore
    }
    return null;
}
