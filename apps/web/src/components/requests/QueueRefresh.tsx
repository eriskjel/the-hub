"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keep queue progress and heartbeat age current while the page is visible. */
export function QueueRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
    const router = useRouter();
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === "visible") router.refresh();
        };
        const timer = setInterval(refresh, intervalMs);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [router, intervalMs]);
    return null;
}
