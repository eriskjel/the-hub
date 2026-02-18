"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

function getMatches(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() => getMatches());

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mql = window.matchMedia(MOBILE_QUERY);
        const onChange = (event: MediaQueryListEvent) => {
            setIsMobile(event.matches);
        };

        setIsMobile(mql.matches);
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return isMobile;
}
