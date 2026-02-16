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

type ThemeToggleProps = {
    variant?: "icon" | "dropdownItem";
    themeLightLabel?: string;
    themeDarkLabel?: string;
};

export default function ThemeToggle({
    variant = "icon",
    themeLightLabel = "Light mode",
    themeDarkLabel = "Dark mode",
}: ThemeToggleProps) {
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

    // Reserve layout slot with skeleton to prevent layout shift and popping
    if (!mounted) {
        if (variant === "dropdownItem") {
            return (
                <div className="flex w-full items-center gap-3 px-4 py-2.5" aria-hidden>
                    <span className="h-4 w-4 flex-shrink-0 animate-pulse rounded bg-white/10" />
                    <span className="h-4 w-24 flex-1 animate-pulse rounded bg-white/10" />
                </div>
            );
        }
        return (
            <span
                className="inline-block h-8 w-8 animate-pulse rounded-md bg-white/10"
                aria-hidden
            />
        );
    }

    const isDark = theme === "dark";
    const displayLabel = isDark ? themeLightLabel : themeDarkLabel;

    if (variant === "dropdownItem") {
        return (
            <button
                type="button"
                onClick={toggle}
                aria-label={displayLabel}
                className="text-foreground hover:bg-surface-subtle flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors"
            >
                {isDark ? (
                    <Sun className="text-muted h-4 w-4" aria-hidden />
                ) : (
                    <Moon className="text-muted h-4 w-4" aria-hidden />
                )}
                <span>{displayLabel}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={displayLabel}
            title={displayLabel}
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
