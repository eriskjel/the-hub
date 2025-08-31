import type { AuthError } from "@supabase/supabase-js";

export function mapSupabaseSignUpError(err: AuthError): string {
    const code = (err.code || "").toLowerCase();
    const msg = (err.message || "").toLowerCase();

    if (code.includes("user_already") || (msg.includes("already") && msg.includes("exist")))
        return "email-already-registered";

    if (
        code.includes("weak") ||
        msg.includes("at least") ||
        (msg.includes("6") && msg.includes("character"))
    )
        return "password-too-short";

    if (code.includes("rate") || msg.includes("too many")) return "rate-limited";

    if (msg.includes("disabled") && msg.includes("signup")) return "signup-disabled";

    return "signup-failed";
}
