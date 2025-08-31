export class HttpError extends Error {
    constructor(
        public status: number,
        message?: string
    ) {
        super(message ?? `HTTP ${status}`);
        this.name = "HttpError";
    }
}

export type GeocodeResult = { lat: number; lon: number; displayName?: string };
export type ReverseGeocodeResult = { city: string | null; displayName: string | null };
