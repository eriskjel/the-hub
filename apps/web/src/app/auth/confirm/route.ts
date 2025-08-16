import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { safeNextPath } from "@/utils/auth/safeNextPath";
import { buildAuthErrorUrl, mapVerifyError } from "@/utils/auth/authReasons";

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

    if (!token_hash) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "no_token", locale));
    }
    if (!type || !ALLOWED_TYPES.includes(type)) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "invalid_type", locale));
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash });
        if (!error) {
            return NextResponse.redirect(new URL(next, url));
        }
        return NextResponse.redirect(buildAuthErrorUrl(url, mapVerifyError(error), locale));
    } catch (e) {
        return NextResponse.redirect(buildAuthErrorUrl(url, "confirm_failed", locale));
    }
}
