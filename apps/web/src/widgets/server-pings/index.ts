import type { Entry } from "../schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import ServerPingsView from "./ServerPingsView";
import { API } from "@/lib/apiRoutes";
import { DEFAULT_WIDGET_DATA_INTERVAL_MS } from "@/utils/timers";
import { PingsData } from "@/widgets/server-pings/types";

export const entry: Entry<"server-pings"> = {
    async fetch(instanceId) {
        const qs = new URLSearchParams({ instanceId }).toString();
        return await fetchJson<PingsData>(`${API.widgets.serverPings}?${qs}`);
    },
    Component: ServerPingsView,
    pollMs: DEFAULT_WIDGET_DATA_INTERVAL_MS,
};
