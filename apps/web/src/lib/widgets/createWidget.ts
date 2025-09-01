import { API } from "@/lib/apiRoutes";
import { parseError } from "@/utils/http";

export async function createWidget(payload: {
    title: string;
    kind: string;
    settings: unknown;
    grid?: { x: number; y: number; w: number; h: number };
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const res = await fetch(API.widgets.create, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                grid: { x: 0, y: 0, w: 1, h: 1, ...payload.grid },
                ...payload,
            }),
        });
        if (!res.ok) return { ok: false, error: await parseError(res) };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
}
