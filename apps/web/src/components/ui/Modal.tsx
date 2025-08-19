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
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
                    </div>
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        className="cursor-pointer rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
