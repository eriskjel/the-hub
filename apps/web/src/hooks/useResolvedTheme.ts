"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function getThemeFromDom(): Theme {
    if (typeof document === "undefined") return "light";
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "dark" || explicit === "light") return explicit;
    if (typeof window.matchMedia === "function") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
}

export function useResolvedTheme(): { theme: Theme; isThemeResolved: boolean } {
    const [theme, setTheme] = useState<Theme>("light");
    const [isThemeResolved, setIsThemeResolved] = useState(false);

    useEffect(() => {
        setTheme(getThemeFromDom());
        setIsThemeResolved(true);

        const observer = new MutationObserver(() => {
            setTheme(getThemeFromDom());
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    return { theme, isThemeResolved };
}
