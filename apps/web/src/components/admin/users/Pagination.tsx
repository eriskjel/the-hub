"use client";

import { useTranslations } from "next-intl";

type Props = {
    page: number;
    setPage: (page: number) => void;
    totalPages: number;
};

export function UsersPagination({ page, setPage, totalPages }: Props) {
    const t = useTranslations("admin.users");

    return (
        <div className="flex w-full items-center justify-between">
            <div className="text-sm text-gray-700">
                {t("pagination.page_of", { page, total: totalPages })}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="rounded-md border bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {t("pagination.prev")}
                </button>
                <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-md border bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {t("pagination.next")}
                </button>
            </div>
        </div>
    );
}
