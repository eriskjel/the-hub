"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

export function useQueryNav() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const setParams = (updates: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(updates)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
        }
        router.push(`${pathname}?${next.toString()}`);
    };

    return { setParams, pathname, params };
}
