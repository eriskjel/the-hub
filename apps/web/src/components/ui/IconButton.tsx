"use client";

import type { ButtonHTMLAttributes, ReactElement } from "react";
import clsx from "clsx";

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
    const { className = "", ...rest } = props;
    return (
        <button
            {...rest}
            className={clsx(
                "text-muted cursor-pointer rounded-lg p-1.5 transition-colors",
                "hover:bg-surface-light hover:text-foreground",
                "focus:ring-border focus:ring-2 focus:outline-none",
                className
            )}
        />
    );
}
