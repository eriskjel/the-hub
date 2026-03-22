export const queryKeys = {
    widget: (userId: string, kind: string, instanceId: string, settingsSig: string) =>
        ["widget", userId, kind, instanceId, settingsSig] as const,
} as const;
