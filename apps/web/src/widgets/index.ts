import type { Registry } from "./schema";
import * as ServerPings from "./server-pings";
import * as GroceryDeals from "./grocery-deals";
import * as Countdown from "./countdown";

export const registry: Registry = {
    "server-pings": ServerPings.entry,
    "grocery-deals": GroceryDeals.entry,
    countdown: Countdown.entry,
};
