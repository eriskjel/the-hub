export type PingsRow = { url: string; status: number; ms: number; checkedAt: string };
export type PingsData = { status: "ok"; data: PingsRow[]; updatedAt: string };
