"use client";

import type { ButtonHTMLAttributes, ReactElement } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "success" | "ghost" | "destructive";

const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-primary/15 text-primary hover:bg-primary/25",
    secondary: "bg-surface-subtle text-muted hover:bg-surface-light hover:text-foreground",
    success: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400",
    ghost: "text-muted hover:bg-surface-light hover:text-foreground",
    destructive: "bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-400",
};

export function Button({
    variant = "secondary",
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): ReactElement {
    return (
        <button
            {...props}
            className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                "focus:ring-border focus:ring-2 focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                variantStyles[variant],
                className
            )}
        />
    );
}
