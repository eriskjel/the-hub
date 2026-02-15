"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type AuthMode = "login" | "signup" | "forgot";

export function useAuthMode() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const modeParam = searchParams.get("mode");
    const mode: AuthMode =
        modeParam === "signup" ? "signup" : modeParam === "forgot" ? "forgot" : "login";
    const isLogin = useMemo(() => mode === "login", [mode]);
    const isSignup = useMemo(() => mode === "signup", [mode]);
    const isForgot = useMemo(() => mode === "forgot", [mode]);

    const switchTo = useCallback(
        (next: AuthMode) => {
            const sp = new URLSearchParams(searchParams);
            sp.set("mode", next);
            sp.delete("error");
            sp.delete("reset");
            router.replace(`${pathname}?${sp.toString()}`);
        },
        [router, pathname, searchParams]
    );

    return { mode, isLogin, isSignup, isForgot, switchTo };
}
