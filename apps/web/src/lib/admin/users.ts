import type { RoleKey } from "@/lib/auth/role";

export const USER_PAGE_SIZES = [5, 10, 20, 50] as const;
export type AdminUsersQuery = { page: number; perPage: number; q: string };
export type AdminUserListItem = {
    id: string;
    name: string;
    email: string;
    role: RoleKey;
    lastSignIn: string | null;
    hasAccess: boolean;
    libraryAccount: string | null;
};
export type AdminUsersResult = AdminUsersQuery & {
    viewerId: string;
    users: AdminUserListItem[];
    total: number;
};

type QueryValue = string | string[] | undefined;
export function parseUsersQuery(params: {
    page?: QueryValue;
    per?: QueryValue;
    q?: QueryValue;
}): AdminUsersQuery {
    const first = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
    const page = Number(first(params.page) ?? 1);
    const per = Number(first(params.per) ?? 10);
    return {
        page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 2147483647) : 1,
        perPage: USER_PAGE_SIZES.find((size) => size === per) ?? 10,
        q: (first(params.q) ?? "").trim().slice(0, 100),
    };
}

export function usersSearchParams(query: AdminUsersQuery) {
    const params = new URLSearchParams({ page: String(query.page), per: String(query.perPage) });
    if (query.q) params.set("q", query.q);
    return params;
}
