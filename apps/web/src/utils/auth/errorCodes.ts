export const AUTH_ERROR_CODES = [
    "invalid-credentials",
    "signup-failed",
    "signup-invalid",
    "name-required",
    "invalid-email",
    "password-too-short",
    "password-mismatch",
    "email-already-registered",
    "rate-limited",
    "signup-disabled",
    "confirm-failed",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const ERROR_KEY_BY_CODE: Record<AuthErrorCode, string> = {
    "invalid-credentials": "invalidCredentials",
    "signup-failed": "signupFailed",
    "signup-invalid": "signupInvalid",
    "name-required": "nameRequired",
    "invalid-email": "invalidEmail",
    "password-too-short": "passwordTooShort",
    "password-mismatch": "passwordMismatch",
    "email-already-registered": "emailAlreadyRegistered",
    "rate-limited": "rateLimited",
    "signup-disabled": "signupDisabled",
    "confirm-failed": "confirmFailed",
};

// Helper to resolve translated message
export function getAuthErrorMessage(t: (k: string) => string, code?: string | null): string | null {
    if (!code) return null;
    const key = ERROR_KEY_BY_CODE[code as AuthErrorCode] ?? "generic";
    return t(`errors.${key}`);
}
