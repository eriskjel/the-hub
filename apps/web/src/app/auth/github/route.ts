import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const qsLocale = url.searchParams.get("locale") || "";
    const locale = qsLocale || (await resolveLocale());
    let next = url.searchParams.get("next") || `/${locale}/dashboard`;
    next = safeNextPath(next);

    const origin = url.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("locale", locale);
    redirectTo.searchParams.set("next", next);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: redirectTo.toString() },
    });

    if (error || !data?.url) {
        return NextResponse.redirect(
            new URL(`/auth/auth-code-error?reason=oauth_init_failed&locale=${locale}`, url)
        );
    }
    return NextResponse.redirect(data.url);
}
