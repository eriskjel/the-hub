export const queryKeys = {
    adminUsersAccess: (viewerId: string) => ["admin-users-access", viewerId] as const,
    adminUsers: (viewerId: string, page: number, perPage: number, q: string) =>
        ["admin-users", viewerId, { page, perPage, q }] as const,
    widget: (userId: string, kind: string, instanceId: string, settingsSig: string) =>
        ["widget", userId, kind, instanceId, settingsSig] as const,
} as const;
