"use client";

import { type ReactElement, type ReactNode, useEffect } from "react";

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
}): ReactElement {
    useEffect(() => {
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";

        return () => {
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
        };
    }, []);

    return (
        // Outer layer is scroll container to handle very small viewports & keyboards
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop + centering wrapper (fills at least the viewport) */}
            <div className="flex min-h-dvh items-center justify-center bg-black/60 p-4">
                {/* The modal panel: cap height and let *it* scroll if needed */}
                <div className="my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-neutral-900 shadow-2xl">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">{title}</h2>
                            {subtitle ? (
                                <p className="text-sm text-neutral-600">{subtitle}</p>
                            ) : null}
                        </div>
                        <button
                            aria-label="Close"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 focus:ring-2 focus:ring-neutral-300 focus:outline-none"
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
        </div>
    );
}