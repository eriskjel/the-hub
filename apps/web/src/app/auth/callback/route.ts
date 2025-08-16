import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";
import { buildAuthErrorUrl, mapExchangeError } from "@/utils/auth/authReasons";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const qsLocale = url.searchParams.get("locale") || "";
    const locale = qsLocale || (await resolveLocale());

    let next = url.searchParams.get("next") || `/${locale}/dashboard`;
    next = safeNextPath(next);

    if (!code) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "no_code", locale));
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            await ensureDefaultRole();
            return NextResponse.redirect(new URL(next, url));
        }
        return NextResponse.redirect(buildAuthErrorUrl(url, mapExchangeError(error), locale));
    } catch (e) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "callback_failed", locale));
    }
}
