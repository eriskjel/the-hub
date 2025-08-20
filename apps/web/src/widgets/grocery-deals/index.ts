import type { Entry } from "@/widgets/schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import GroceryDealsView from "./GroceryDealsView";

export const entry: Entry<"grocery-deals"> = {
    fetch: (instanceId) =>
        fetchJson(`/api/widgets/grocery-deals?instanceId=${encodeURIComponent(instanceId)}`),
    Component: GroceryDealsView,
};
