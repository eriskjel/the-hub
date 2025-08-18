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
