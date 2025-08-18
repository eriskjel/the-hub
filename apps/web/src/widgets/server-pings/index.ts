import type { Entry } from "../schema";
import { fetchJson } from "@/lib/widgets/fetchJson";
import ServerPingsView from "./ServerPingsView";

// NOTE: For now we keep using your existing PingsData type from types/widgets/data.
// The Entry<"server-pings"> typing comes from schema.ts and ensures Component+fetch match.
export const entry: Entry<"server-pings"> = {
    // If your API route is /api/widgets/server-pings, keep that path
    fetch: (instanceId) =>
        fetchJson(`/api/widgets/server-pings?instanceId=${encodeURIComponent(instanceId)}`),

    Component: ServerPingsView,
};
