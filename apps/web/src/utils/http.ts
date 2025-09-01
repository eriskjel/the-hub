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
    try {
        const j = await res.json();
        return j?.error || j?.message || `HTTP ${res.status}`;
    } catch {
        return `HTTP ${res.status}`;
    }
}
