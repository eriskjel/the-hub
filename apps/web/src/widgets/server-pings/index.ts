import type { Entry } from "../schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import ServerPingsView from "./ServerPingsView";
import { API } from "@/lib/apiRoutes";

export const entry: Entry<"server-pings"> = {
    fetch: (instanceId) => {
        const qs = new URLSearchParams({ instanceId }).toString();
        return fetchJson(`${API.widgets.pings}?${qs}`);
    },
    Component: ServerPingsView,
};
