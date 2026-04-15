import "server-only";

import { bearerToken, backendUrl } from "@/server/proxy/utils";
import type { CountdownSettings } from "@/widgets/schema";

export type CountdownProviderStatus = {
    providerId: string;
    nextIso: string | null;
    tentative: boolean;
    adminConfirmed: boolean;
};

export async function fetchProviderStatus(
    providerId: CountdownSettings["provider"]
): Promise<CountdownProviderStatus | null> {
    try {
        const token = await bearerToken();
        if (!token) return null;
        const res = await fetch(backendUrl("/api/admin/widgets/countdown/status", { providerId }), {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export type CountdownDeniedEntry = {
    providerId: string;
    deniedDate: string;
    reason: string | null;
    deniedBy: string | null;
    deniedAt: string | null;
};

export async function fetchDeniedDates(
    providerId: CountdownSettings["provider"]
): Promise<CountdownDeniedEntry[]> {
    try {
        const token = await bearerToken();
        if (!token) return [];
        const res = await fetch(backendUrl("/api/admin/widgets/countdown/denied", { providerId }), {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}
