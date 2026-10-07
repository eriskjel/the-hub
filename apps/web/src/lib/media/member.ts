import { z } from "zod";

/** Mirrors the media_member checks in the database. */
export const LIBRARY_ACCOUNT_PATTERN = "[A-Za-z0-9._-]{1,64}";
export const LIBRARY_ACCOUNT_MAX_LENGTH = 64;
export const MAX_WEEKLY_QUOTA = 50;
export const DEFAULT_WEEKLY_QUOTA = 5;

export type MediaMember = {
    userId: string;
    libraryAccount: string | null;
    weeklyQuota: number;
    grantedAt: string;
    revokedAt: string | null;
};

export function isActiveMember(
    member: MediaMember | null | undefined
): member is MediaMember & { revokedAt: null } {
    return member != null && member.revokedAt === null;
}

export type MemberActionError =
    | "invalid_account"
    | "invalid_quota"
    | "account_required"
    | "account_taken"
    | "not_found"
    | "failed";

export type MemberActionState =
    | { status: "idle" }
    | { status: "saved" }
    | { status: "revoked" }
    | { status: "error"; error: MemberActionError };

export const memberFormSchema = z.object({
    userId: z.string().uuid(),
    // Empty means "no account", which only admins may have.
    libraryAccount: z
        .string()
        .trim()
        .refine((s) => s === "" || new RegExp(`^${LIBRARY_ACCOUNT_PATTERN}$`).test(s))
        .transform((s) => (s === "" ? null : s)),
    weeklyQuota: z
        .string()
        .trim()
        .regex(/^\d{1,2}$/)
        .transform(Number)
        .refine((n) => n <= MAX_WEEKLY_QUOTA),
});
