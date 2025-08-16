import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const qsLocale = url.searchParams.get("locale") || "";
    const locale = qsLocale || (await resolveLocale());
    let next = url.searchParams.get("next") || `/${locale}/dashboard`;
    next = safeNextPath(next);

    if (!code) {
        return NextResponse.redirect(
            new URL(`/auth/auth-code-error?reason=no_code&locale=${locale}`, url)
        );
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            await ensureDefaultRole();
            return NextResponse.redirect(new URL(next, url));
        }
        const msg = error.message || "exchange_failed";
        return NextResponse.redirect(
            new URL(`/auth/auth-code-error?reason=${encodeURIComponent(msg)}&locale=${locale}`, url)
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "callback_failed";
        return NextResponse.redirect(
            new URL(
                `/auth/auth-code-error?reason=${encodeURIComponent(message)}&locale=${locale}`,
                url
            )
        );
    }
}
