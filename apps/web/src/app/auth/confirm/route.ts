import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";
import { buildAuthErrorUrl, mapVerifyError } from "@/utils/auth/authReasons";
import { getSafeOrigin } from "@/utils/auth/getSafeOrigin";

const ALLOWED_TYPES: EmailOtpType[] = [
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "email",
];

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token_hash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;
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
        console.error("[auth/confirm] origin resolution failed:", e);
        // Fallback to url.origin if getSafeOrigin fails
        origin = url.origin.replace("0.0.0.0", "localhost");
        return NextResponse.redirect(buildAuthErrorUrl(url, "confirm_failed", locale, origin));
    }

    if (!token_hash) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "no_token", locale, origin));
    }
    if (!type || !ALLOWED_TYPES.includes(type)) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "invalid_type", locale, origin));
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash });
        if (!error) {
            return NextResponse.redirect(new URL(next, origin));
        }
        return NextResponse.redirect(buildAuthErrorUrl(url, mapVerifyError(error), locale, origin));
    } catch (err: unknown) {
        console.error("Auth callback failed:", err);
        return NextResponse.redirect(buildAuthErrorUrl(url, "confirm_failed", locale, origin));
    }
}
