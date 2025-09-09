import type { Entry } from "@/widgets/schema";
import CountdownView from "./view";
import { fetchJson } from "@/lib/widgets/fetchJson";
import { API } from "@/lib/apiRoutes";

export const entry: Entry<"countdown"> = {
    fetch: (instanceId) => {
        const qs = new URLSearchParams({ instanceId }).toString();
        return fetchJson(`${API.widgets.countdown}?${qs}`);
    },
    Component: CountdownView,
    pollMs: 3 * 60 * 60 * 1000, // 12 hours
};
