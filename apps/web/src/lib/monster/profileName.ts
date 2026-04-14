/**
 * Normalize profile display names across monster feeds — everyone shows as
 * a single first name regardless of whether their profile has `full_name` or
 * only `username`. Keeps the feed visually consistent.
 */
export function displayFirstName(
    fullName: string | null | undefined,
    username: string | null | undefined
): string {
    const fromFull = fullName?.trim().split(/\s+/)[0];
    if (fromFull) return capitalize(fromFull);
    const fromUser = username?.trim().split(/[.\-_\s]+/)[0];
    if (fromUser) return capitalize(fromUser);
    return "Anonymous";
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
