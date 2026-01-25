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
export function mapExchangeError(_err?: unknown): AuthReasonToken {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return "exchange_failed";
}

export function mapVerifyError(_err?: unknown): AuthReasonToken {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return "verify_failed";
}

export function mapOauthInitError(_err?: unknown): AuthReasonToken {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return "oauth_init_failed";
}

// Build a /auth/auth-code-error URL with token + optional locale
export function buildAuthErrorUrl(
    base: URL,
    token: AuthReasonToken,
    locale?: string,
    origin?: string
): URL {
    // Use provided origin if available (fixes Docker 0.0.0.0 issue), otherwise use base
    const baseOrigin = origin || base.origin;
    const u = new URL("/auth/auth-code-error", baseOrigin);
    u.searchParams.set("reason", token);
    if (locale) u.searchParams.set("locale", locale);
    return u;
}
