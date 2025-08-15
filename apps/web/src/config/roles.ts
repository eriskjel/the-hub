export const ALLOWED_ROLES = ["user", "admin"] as const;
export type Role = (typeof ALLOWED_ROLES)[number];
export const DEFAULT_ROLE: Role = "user";
