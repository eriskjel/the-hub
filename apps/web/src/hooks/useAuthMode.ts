"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type AuthMode = "login" | "signup";

export function useAuthMode() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const modeParam = searchParams.get("mode");
    const mode: AuthMode = modeParam === "signup" ? "signup" : "login";
    const isLogin = useMemo(() => mode === "login", [mode]);

    const switchTo = useCallback(
        (next: AuthMode) => {
            const sp = new URLSearchParams(searchParams);
            sp.set("mode", next);
            sp.delete("error");
            router.replace(`${pathname}?${sp.toString()}`);
        },
        [router, pathname, searchParams]
    );

    return { mode, isLogin, switchTo };
}
