"use client";

import { Moon, Sun } from "lucide-react";
import { Theme, useResolvedTheme } from "@/hooks/useResolvedTheme";

const THEME_KEY = "theme";

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
    const { theme, isThemeResolved } = useResolvedTheme();

    const toggle = () => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
    };

    // Reserve layout slot with skeleton to prevent layout shift and popping
    if (!isThemeResolved) {
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
