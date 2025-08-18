"use client";

import { useEffect } from "react";

const CURRENT_USER_KEY = "hub:current-user-id";

export default function ClientCacheGuard({ userId }: { userId: string | null }) {
    useEffect(() => {
        const prev = localStorage.getItem(CURRENT_USER_KEY);
        if (prev && prev !== (userId ?? "")) {
            // Different user than last time: wipe any old per-user caches
            // (We only wipe keys we own: "hub:u:")
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith("hub:u:")) {
                    localStorage.removeItem(k);
                }
            }
        }
        localStorage.setItem(CURRENT_USER_KEY, userId ?? "");
    }, [userId]);

    return null;
}
