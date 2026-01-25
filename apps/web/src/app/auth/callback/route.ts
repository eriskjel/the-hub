import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";
import { buildAuthErrorUrl, mapExchangeError } from "@/utils/auth/authReasons";
import { getSafeOrigin } from "@/utils/auth/getSafeOrigin";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const qsLocale = url.searchParams.get("locale") || "";
    const locale = qsLocale || (await resolveLocale());

    let next = url.searchParams.get("next") || `/${locale}/dashboard`;
    next = safeNextPath(next);

    // Get the correct origin (fixes Docker 0.0.0.0 issue)
    let origin: string;
    try {
        const hostHeader = req.headers.get("host");
        origin = getSafeOrigin(url, hostHeader);
    } catch (e) {
        console.error("[auth/callback] origin resolution failed:", e);
        // Fallback to url.origin if getSafeOrigin fails
        origin = url.origin.replace("0.0.0.0", "localhost");
        return NextResponse.redirect(buildAuthErrorUrl(url, "callback_failed", locale, origin));
    }

    if (!code) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "no_code", locale, origin));
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            await ensureDefaultRole();
            return NextResponse.redirect(new URL(next, origin));
        }
        return NextResponse.redirect(
            buildAuthErrorUrl(url, mapExchangeError(error), locale, origin)
        );
    } catch (err: unknown) {
        console.error("Auth callback failed:", err);
        return NextResponse.redirect(buildAuthErrorUrl(url, "callback_failed", locale, origin));
    }
}
