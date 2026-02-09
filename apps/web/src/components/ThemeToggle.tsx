"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "theme";
type Theme = "light" | "dark";

function getTheme(): Theme {
    if (typeof document === "undefined") return "light";
    const stored = document.documentElement.dataset.theme as Theme | undefined;
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(next: Theme) {
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch {
        /* ignore */
    }
    document.documentElement.dataset.theme = next;
}

export default function ThemeToggle() {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setThemeState(getTheme());
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const observer = new MutationObserver(() => setThemeState(getTheme()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, [mounted]);

    const toggle = () => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        setThemeState(next);
    };

    if (!mounted) return null;

    const isDark = theme === "dark";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            title={label}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-white/10 focus:ring-2 focus:ring-white/40 focus:outline-none"
        >
            {isDark ? (
                <Sun className="h-5 w-5 text-white" aria-hidden />
            ) : (
                <Moon className="h-5 w-5 text-white" aria-hidden />
            )}
        </button>
    );
}
