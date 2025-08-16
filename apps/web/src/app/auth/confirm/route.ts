import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
    const locale = url.searchParams.get("locale") || ""; // optional
    let next = url.searchParams.get("next") || (locale ? `/${locale}/dashboard` : "/");

    // allow only relative paths
    if (!next.startsWith("/")) next = "/";

    if (!token_hash) {
        return NextResponse.redirect(new URL("/auth/auth-code-error?reason=no_token", url));
    }
    if (!type || !ALLOWED_TYPES.includes(type)) {
        return NextResponse.redirect(new URL("/auth/auth-code-error?reason=invalid_type", url));
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash });
        if (!error) {
            return NextResponse.redirect(new URL(next, url));
        }
        return NextResponse.redirect(
            new URL(`/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`, url)
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "confirm_failed";
        return NextResponse.redirect(
            new URL(`/auth/auth-code-error?reason=${encodeURIComponent(message)}`, url)
        );
    }
}
