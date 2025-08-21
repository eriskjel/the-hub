import type { Entry } from "@/widgets/schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import GroceryDealsView from "./GroceryDealsView";
import { API } from "@/lib/apiRoutes";
import { GROCERY_WIDGET_DATA_INTERVAL_MS } from "@/utils/timers";

export const entry: Entry<"grocery-deals"> = {
    fetch: (instanceId) => {
        const qs = new URLSearchParams({ instanceId }).toString();
        return fetchJson(`${API.widgets.groceryDeals}?${qs}`);
    },
    Component: GroceryDealsView,
    pollMs: GROCERY_WIDGET_DATA_INTERVAL_MS,
};
