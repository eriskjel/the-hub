"use client";

import { type ReactElement, type ReactNode, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export function Modal({
    title,
    subtitle,
    children,
    onClose,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
}): ReactElement | null {
    const el = useMemo(() => {
        if (typeof document === "undefined") return null;
        const div = document.createElement("div");
        div.setAttribute("data-portal", "modal-root");
        return div;
    }, []);

    useEffect(() => {
        if (!el || typeof document === "undefined") return;
        document.body.appendChild(el);
        // lock scroll
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";

        return () => {
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
            el.remove();
        };
    }, [el]);

    if (!el) return null;

    return createPortal(
        // Outer layer is scroll container to handle very small viewports & keyboards
        <div
            className={clsx(
                "fixed inset-0 z-[1000] cursor-pointer overflow-y-auto" // bump way above any z-50 headers
            )}
            role="dialog"
            aria-modal="true"
            onClick={onClose} // clicking the backdrop closes
        >
            {/* Backdrop + centering wrapper (fills at least the viewport) */}
            <div
                className="flex min-h-dvh cursor-default items-center justify-center bg-black/60 p-4"
                onClick={(e) => e.stopPropagation()} // prevent backdrop click from reaching panel
            >
                {/* The modal panel: cap height and let *it* scroll if needed */}
                <div className="my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-neutral-900 shadow-2xl">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold">{title}</h2>
                            {subtitle ? (
                                <p className="text-sm text-neutral-600">{subtitle}</p>
                            ) : null}
                        </div>
                        <button
                            aria-label="Close"
                            onClick={onClose}
                            className="cursor-pointer rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 focus:ring-2 focus:ring-neutral-300 focus:outline-none"
                        >
                            <svg
                                viewBox="0 0 20 20"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 6l8 8M14 6l-8 8"
                                />
                            </svg>
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>,
        el
    );
}
