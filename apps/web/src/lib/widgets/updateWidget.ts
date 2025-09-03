import { API } from "@/lib/apiRoutes";
import { parseError } from "@/utils/http";

export async function updateWidget(id: string, payload: Record<string, unknown>) {
    try {
        const res = await fetch(API.widgets.byId(id), {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "same-origin",
        });
        if (!res.ok) return { ok: false as const, error: await parseError(res) };
        return { ok: true as const };
    } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Network error" };
    }
}
