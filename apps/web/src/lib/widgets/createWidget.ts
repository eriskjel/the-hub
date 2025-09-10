import { API } from "@/lib/apiRoutes";
import { parseError } from "@/utils/http";

export async function createWidget(payload: {
    kind: string;
    settings: unknown;
    grid?: { x: number; y: number; w: number; h: number };
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const body: Record<string, unknown> = {
            kind: payload.kind,
            settings: payload.settings,
        };

        // Only send grid if explicitly provided
        if (payload.grid) {
            body.grid = payload.grid;
        }

        const res = await fetch(API.widgets.create, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) return { ok: false, error: await parseError(res) };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
}
