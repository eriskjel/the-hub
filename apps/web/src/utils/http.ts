/** Detect common network-ish errors (client-safe) */
export function isOfflineError(msg: string): boolean {
    return /(timed\s*out|connection\s*failed|backend_unreachable|fetch\s*failed|network|ECONN|ENOTFOUND|EAI_AGAIN|5\d\d)/i.test(
        msg
    );
}

/** Narrow unknown errors to AbortError in browser & Node (client-safe) */
export function isAbortError(e: unknown): e is DOMException {
    if (e instanceof DOMException && e.name === "AbortError") return true;
    if (typeof e === "object" && e !== null) {
        const err = e as { name?: string; code?: string };
        if (err.name === "AbortError") return true;
        if (err.code === "ABORT_ERR") return true;
    }
    return false;
}

const isCode = (s: unknown) => typeof s === "string" && /^[a-z0-9._-]+$/i.test(s);

const statusToCode = (s: number): string => {
    switch (s) {
        case 400:
            return "invalid_request";
        case 401:
            return "unauthorized";
        case 403:
            return "forbidden";
        case 404:
            return "not_found";
        case 409:
            return "duplicate";
        default:
            return "server_error";
    }
};

export async function parseError(res: Response): Promise<string> {
    const ct = res.headers.get("content-type") ?? "";

    if (ct.includes("application/json")) {
        const j = await res.json().catch(() => null);
        if (j && isCode((j as Record<string, unknown>)?.error)) {
            return (j as Record<string, unknown>).error as string;
        }
    } else {
        // if server sent non-JSON, we won't try to parse it
        await res.text().catch(() => undefined);
    }

    return statusToCode(res.status);
}
