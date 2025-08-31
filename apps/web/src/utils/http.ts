import { cookies } from "next/headers";

export async function makeForwardedCookieHeader(): Promise<string> {
    const jar = await cookies();
    return jar
        .getAll()
        .map((cookies) => `${cookies.name}=${cookies.value}`)
        .join("; ");
}

export function isOfflineError(msg: string): boolean {
    return /(timed\s*out|connection\s*failed|backend_unreachable|fetch\s*failed|network|ECONN|ENOTFOUND|EAI_AGAIN|5\d\d)/i.test(
        msg
    );
}

/**
 * Narrow unknown errors to an AbortError in both browser and Node.
 */
export function isAbortError(e: unknown): e is DOMException {
    if (e instanceof DOMException && e.name === "AbortError") return true;
    if (typeof e === "object" && e !== null) {
        const anyErr = e as { name?: string; code?: string };
        // Some runtimes set code instead of name
        if (anyErr.name === "AbortError") return true;
        if (anyErr.code === "ABORT_ERR") return true;
    }
    return false;
}
