import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    let next = url.searchParams.get("next") || "/";

    // allow only relative paths
    if (!next.startsWith("/")) next = "/";

    if (code) {
        try {
            const supabase = await createClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                await ensureDefaultRole();
                return NextResponse.redirect(new URL(next, url));
            }
            return NextResponse.redirect(
                new URL(`/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`, url)
            );
        } catch (e: any) {
            return NextResponse.redirect(
                new URL(
                    `/auth/auth-code-error?reason=${encodeURIComponent(e?.message ?? "callback_failed")}`,
                    url
                )
            );
        }
    }
    return NextResponse.redirect(new URL("/auth/auth-code-error?reason=no_code", url));
}
