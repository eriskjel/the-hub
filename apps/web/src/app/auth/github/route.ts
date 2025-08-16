import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";
import { getSafeOrigin } from "@/utils/auth/getSafeOrigin";
import { buildAuthErrorUrl, mapOauthInitError } from "@/utils/auth/authReasons";

export async function GET(req: NextRequest) {
    const url = req.nextUrl;
    const qsLocale = url.searchParams.get("locale") || "";
    const locale = qsLocale || (await resolveLocale());

    let next = url.searchParams.get("next") || `/${locale}/dashboard`;
    next = safeNextPath(next);

    let origin: string;
    try {
        origin = getSafeOrigin(url);
    } catch (e) {
        // fail fast if misconfigured
        return new NextResponse(String(e instanceof Error ? e.message : e), { status: 500 });
    }

    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("locale", locale);
    redirectTo.searchParams.set("next", next);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: redirectTo.toString() },
    });

    if (error || !data?.url) {
        console.error("[auth/github] oauth init error:", error);
        return NextResponse.redirect(buildAuthErrorUrl(url, mapOauthInitError(error), locale));
    }
    return NextResponse.redirect(data.url);
}
