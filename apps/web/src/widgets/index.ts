import type { Registry } from "./schema";
import * as ServerPings from "./server-pings";

export const registry: Registry = {
    "server-pings": ServerPings.entry,
    // Add more widgets here as you create them
};
