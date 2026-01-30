"use client";

import type { ButtonHTMLAttributes, ReactElement } from "react";
import clsx from "clsx";

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
    const { className = "", ...rest } = props;
    return (
        <button
            {...rest}
            className={clsx(
                "cursor-pointer rounded-lg p-1.5 text-neutral-500 transition-colors",
                "hover:bg-neutral-200 hover:text-neutral-800",
                "focus:ring-2 focus:ring-neutral-300 focus:outline-none",
                className
            )}
        />
    );
}
