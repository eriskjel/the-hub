export type PingsRow = { url: string; status: number; ms: number; checkedAt: string };
export type PingsData = { status: "ok"; data: PingsRow[]; updatedAt: string };

export type PiHealthRow = {
    deviceId: string;
    name: string;
    lastSeen: string | null;
    snapshot: Record<string, unknown> | null;
    ts: string | null;
};
export type PiHealthData = { status: "ok"; data: PiHealthRow[]; updatedAt: string };
