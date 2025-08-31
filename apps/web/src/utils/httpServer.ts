import "server-only";
import { cookies } from "next/headers";

export async function makeForwardedCookieHeader(): Promise<string> {
    const jar = await cookies();
    return jar
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
}
