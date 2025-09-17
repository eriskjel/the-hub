"use client";

import { ReactElement } from "react";

type Props = {
    page: number;
    setPage: (page: number) => void;
    totalPages: number;
    label?: (page: number, totalPages: number) => string;
    prevLabel: string;
    nextLabel: string;
};

export function PaginationControls({
    page,
    setPage,
    totalPages,
    label,
    prevLabel,
    nextLabel,
}: Props): ReactElement {
    return (
        <div className="flex w-full items-center justify-between">
            <div className="text-sm text-gray-700">
                {label ? label(page, totalPages) : `Page ${page} of ${totalPages}`}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="cursor-pointer rounded-md border bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {prevLabel}
                </button>
                <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="cursor-pointer rounded-md border bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {nextLabel}
                </button>
            </div>
        </div>
    );
}
