"use client";

import type { ButtonHTMLAttributes, ReactElement } from "react";
import clsx from "clsx";

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
    const { className = "", ...rest } = props;
    return (
        <button
            {...rest}
            className={clsx(
                "cursor-pointer rounded-lg p-1.5 text-muted transition-colors",
                "hover:bg-surface-light hover:text-foreground",
                "focus:ring-2 focus:ring-border focus:outline-none",
                className
            )}
        />
    );
}
