"use client";

import { useEffect } from "react";

// Key used to store the current user's ID in localStorage.
// This allows other parts of the application (including non-React code or code running outside the React tree)
// to access the current user's ID on the client side, for example, to personalize user experience or
// to synchronize authentication state across browser tabs. Storing the user ID in localStorage is a design
// decision to enable such cross-context access, but care should be taken not to store sensitive information.
const CURRENT_USER_KEY = "hub:current-user-id";

/**
 * ClientCacheGuard is a React component that synchronizes the current user's ID to localStorage.
 * This is necessary so that client-side scripts or other browser tabs can access the user ID,
 * enabling features like cross-tab authentication state or personalization.
 * The user ID is stored under the CURRENT_USER_KEY in localStorage whenever it changes.
 */
export default function ClientCacheGuard({ userId }: { userId: string | null }) {
    useEffect(() => {
        localStorage.setItem(CURRENT_USER_KEY, userId ?? "");
    }, [userId]);
    return null;
}
