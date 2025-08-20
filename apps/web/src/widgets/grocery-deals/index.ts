import type { Entry } from "@/widgets/schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import GroceryDealsView from "./GroceryDealsView";
import { API } from "@/lib/apiRoutes";

export const entry: Entry<"grocery-deals"> = {
    fetch: (instanceId) => {
        const qs = new URLSearchParams({ instanceId }).toString();
        return fetchJson(`${API.widgets.groceryDeals}?${qs}`);
    },
    Component: GroceryDealsView,
};
