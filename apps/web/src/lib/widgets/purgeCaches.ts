import { WidgetKind } from "@/widgets/schema";

export function purgeWidgetLocalCache(
    userId: string | null | undefined,
    kind: WidgetKind | string | undefined,
    instanceId: string | undefined
): void {
    if (!kind || !instanceId) return;

    const keys = new Set<string>();

    // If we have a concrete userId, purge that key
    if (userId) keys.add(`hub:u:${userId}:widget:${kind}:${instanceId}`);

    // Always purge the anon key too (covers edits done when userId was missing in props)
    keys.add(`hub:u:anon:widget:${kind}:${instanceId}`);

    try {
        for (const k of keys) {
            localStorage.removeItem(k);
            // console.debug("[purge] removed", k);
        }
    } catch {
        /* ignore */
    }
}
