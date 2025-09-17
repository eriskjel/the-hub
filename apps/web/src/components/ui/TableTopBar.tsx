"use client";

import { ReactElement } from "react";

type Props = {
    total: number;
    pageSize: number;
    perPageOptions?: number[];
    totalLabel: (total: number) => string;
    perPageLabel: string;
    onChangePerPage: (perPage: number) => void;
};

export default function TableTopBar({
    total,
    pageSize,
    perPageOptions = [5, 10, 20],
    totalLabel,
    perPageLabel,
    onChangePerPage,
}: Props): ReactElement {
    return (
        <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">{totalLabel(total)}</div>

            <div className="flex items-center gap-2">
                <label htmlFor="per-page" className="text-sm text-gray-600">
                    {perPageLabel}
                </label>
                <select
                    id="per-page"
                    value={String(pageSize)}
                    onChange={(e) => onChangePerPage(Number(e.target.value))}
                    className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-sm"
                >
                    {perPageOptions.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
