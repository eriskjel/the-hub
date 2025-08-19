"use client";

import type { ReactElement, ReactNode } from "react";

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
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-neutral-900 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
                    </div>
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                    >
                        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l8 8M14 6l-8 8"/>
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
