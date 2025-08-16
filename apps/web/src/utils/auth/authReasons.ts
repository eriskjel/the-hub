export const AUTH_REASON_TOKENS = [
    "no_code",
    "no_token",
    "invalid_type",
    "exchange_failed",
    "verify_failed",
    "oauth_init_failed",
    "confirm_failed",
    "callback_failed",
    "unknown_reason",
] as const;

export type AuthReasonToken = (typeof AUTH_REASON_TOKENS)[number];

export function isAuthReasonToken(x: string): x is AuthReasonToken {
    return (AUTH_REASON_TOKENS as readonly string[]).includes(x);
}

// --- Heuristic mappers (keep simple & conservative) ---
export function mapExchangeError(err: unknown): AuthReasonToken {
    const msg = toMsg(err);
    // common PKCE/code issues
    if (includesAny(msg, ["code verifier", "pkce", "invalid_grant", "expired"])) {
        return "exchange_failed";
    }
    return "exchange_failed";
}

export function mapVerifyError(err: unknown): AuthReasonToken {
    const msg = toMsg(err);
    if (includesAny(msg, ["expired", "invalid", "token"])) {
        return "verify_failed";
    }
    return "verify_failed";
}

export function mapOauthInitError(err: unknown): AuthReasonToken {
    return "oauth_init_failed";
}

// Build a /auth/auth-code-error URL with token + optional locale
export function buildAuthErrorUrl(base: URL, token: AuthReasonToken, locale?: string): URL {
    const u = new URL("/auth/auth-code-error", base);
    u.searchParams.set("reason", token);
    if (locale) u.searchParams.set("locale", locale);
    return u;
}

// --- small utils ---
function toMsg(err: unknown): string {
    if (err && typeof err === "object" && "message" in err && err.message) {
        return String((err as any).message).toLowerCase();
    }
    return "";
}
function includesAny(hay: string, needles: string[]) {
    return needles.some((n) => hay.includes(n));
}
