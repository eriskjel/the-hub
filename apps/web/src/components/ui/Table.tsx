"use client";

import { TableComponent as LibTable } from "nextjs-reusable-table";
import type { ReactNode } from "react";
import "nextjs-reusable-table/dist/index.css";
import { cn } from "@/utils/cn";

/** Mirrors the README prop surface and matches the lib's types */
export type LibTableProps<T> = {
    columns: string[];
    data: T[];
    props: (keyof T)[];

    // Core features
    actions?: boolean;
    actionTexts?: string[];
    actionFunctions?: Array<(item: T) => void>;
    loading?: boolean;
    searchValue?: string;

    // Row behavior
    rowOnClick?: (item: T) => void;

    // Pagination
    enablePagination?: boolean;
    page?: number;
    setPage?: (page: number) => void;
    itemsPerPage?: number;
    totalPages?: number;

    // Sorting
    sortableProps?: (keyof T)[];
    onSort?: (prop: keyof T) => void;

    formatValue?: (value: string, prop: string, item: T) => ReactNode;
    formatHeader?: (header: string, prop: string, index: number) => ReactNode;

    // Appearance
    enableDarkMode?: boolean;
    disableDefaultStyles?: boolean;
    customClassNames?: {
        table?: string;
        thead?: string;
        tbody?: string;
        th?: string;
        tr?: string;
        td?: string;
        pagination?: {
            container?: string;
            button?: string;
            buttonDisabled?: string;
            pageInfo?: string;
        };
    };

    // Empty state
    noContentProps?: {
        text?: string;
        icon?: ReactNode | null;
    };

    // Custom rows
    renderRow?: (item: T) => ReactNode;
};

export type DataTableProps<T> = Omit<LibTableProps<T>, "enableDarkMode" | "customClassNames"> & {
    density?: "compact" | "comfy";
    className?: string;
    classes?: NonNullable<LibTableProps<T>["customClassNames"]>;
};

export function DataTable<T>({
    density = "comfy",
    className,
    classes,
    ...rest
}: DataTableProps<T>): ReactNode {
    const base = "text-sm w-full table-fixed";
    const densityCls = density === "compact" ? "[&_*]:py-2 [&_*]:px-3" : "[&_*]:py-3 [&_*]:px-4";

    return (
        <LibTable
            {...(rest as LibTableProps<T>)}
            enableDarkMode={false}
            customClassNames={{
                table: cn(base, densityCls, className, classes?.table),
                thead: cn("bg-gray-50 text-gray-600", classes?.thead),
                tbody: cn("", classes?.tbody),
                th: cn("font-medium text-left align-middle", classes?.th),
                tr: cn("", classes?.tr),
                td: cn("align-middle overflow-hidden text-ellipsis", classes?.td), // 👈 base ellipsis
                pagination: {
                    container: cn(
                        "flex items-center justify-between p-4",
                        classes?.pagination?.container
                    ),
                    button: cn(
                        "rounded px-3 py-1 bg-gray-200 disabled:opacity-50",
                        classes?.pagination?.button
                    ),
                    buttonDisabled: cn(
                        "bg-gray-200 opacity-50",
                        classes?.pagination?.buttonDisabled
                    ),
                    pageInfo: cn("text-sm opacity-70", classes?.pagination?.pageInfo),
                },
            }}
        />
    );
}

export default DataTable;
