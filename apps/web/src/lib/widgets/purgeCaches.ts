import { WidgetKind } from "@/widgets/schema";

export function purgeWidgetLocalCache(
    userId?: string | null,
    kind?: WidgetKind | string,
    instanceId?: string
): void {
    if (!userId || !kind || !instanceId) return;
    try {
        const key = `hub:u:${userId}:widget:${kind}:${instanceId}`;
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}
