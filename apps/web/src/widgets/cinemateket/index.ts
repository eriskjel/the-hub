import { fetchJson } from "@/lib/widgets/fetchJson";
import CinemateketView from "./CinemateketView";
import { API } from "@/lib/apiRoutes";
import { Entry } from "@/widgets/schema";

export const entry: Entry<"cinemateket"> = {
    fetch: (instanceId) => {
        const qs = new URLSearchParams({ instanceId }).toString();
        return fetchJson(`${API.widgets.cinemateket}?${qs}`);
    },
    Component: CinemateketView,
    pollMs: 6 * 60 * 60 * 1000, // 6 hours - program doesn't change that often
};
