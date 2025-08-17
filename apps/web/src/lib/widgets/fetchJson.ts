export class HttpError extends Error {
    constructor(
        public status: number,
        public body: unknown,
        message?: string
    ) {
        super(message ?? `${status}`);
    }
}

export class DegradedError extends Error {
    constructor(public body?: unknown) {
        super("degraded");
    }
}

// Type guard to check if body has degraded status
function isDegradedResponse(body: unknown): body is { status: string } | { error: string } {
    return typeof body === "object" && body !== null && ("status" in body || "error" in body);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text().catch(() => "");

    let body: unknown;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }

    if (!res.ok) {
        // Treat our proxy's offline mode specially
        if (res.status === 503 && isDegradedResponse(body)) {
            const degradedBody = body as { status?: string; error?: string };
            if (
                degradedBody.status === "degraded" ||
                degradedBody.error === "backend_unreachable"
            ) {
                throw new DegradedError(body);
            }
        }
        throw new HttpError(res.status, body, `${res.status} ${res.statusText}`);
    }

    // If backend returned empty body but was OK
    return (body ?? ({} as T)) as T;
}
