"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keep queue progress and heartbeat age current while the page is visible. */
export function QueueRefresh() {
    const router = useRouter();
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === "visible") router.refresh();
        };
        const timer = setInterval(refresh, 60_000);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [router]);
    return null;
}
