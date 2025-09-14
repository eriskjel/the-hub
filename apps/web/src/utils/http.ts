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

export async function parseError(res: Response): Promise<string> {
    const isCode = (s: unknown) => typeof s === "string" && /^[a-z0-9._-]+$/i.test(s);

    try {
        const j = await res.json();

        if (isCode(j?.error)) return j.error; // <- the contract you want
        // If it's not a code (or missing), map by status — never return prose as a code
        if (res.status === 403) return "forbidden";
        if (res.status === 409) return "duplicate";
        if (res.status === 400) return "invalid_request";
        return "generic";
    } catch {
        if (res.status === 403) return "forbidden";
        if (res.status === 409) return "duplicate";
        if (res.status === 400) return "invalid_request";
        return "generic";
    }
}
