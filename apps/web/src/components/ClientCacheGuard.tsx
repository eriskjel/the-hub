"use client";

import { useEffect } from "react";

const CURRENT_USER_KEY = "hub:current-user-id";

export default function ClientCacheGuard({ userId }: { userId: string | null }) {
    useEffect(() => {
        localStorage.setItem(CURRENT_USER_KEY, userId ?? "");
    }, [userId]);
    return null;
}
