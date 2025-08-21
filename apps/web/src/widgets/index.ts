import type { Registry } from "./schema";
import * as ServerPings from "./server-pings";
import * as GroceryDeals from "./grocery-deals";

export const registry: Registry = {
    "server-pings": ServerPings.entry,
    "grocery-deals": GroceryDeals.entry,
};
