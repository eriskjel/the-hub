import { API } from "@/lib/apiRoutes";
import { parseError } from "@/utils/http";

export async function deleteWidget(
    id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const res = await fetch(API.widgets.byId(id), { method: "DELETE" });
        if (!res.ok) return { ok: false, error: await parseError(res) };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
}
