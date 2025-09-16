"use client";

import { useTranslations } from "next-intl";
import { useQueryNav } from "@/hooks/useQueryNav";
export default function UsersTopBar({ total, pageSize }: { total: number; pageSize: number }) {
    const t = useTranslations("admin.users");
    const { setParams } = useQueryNav();

    return (
        <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
                {t("pagination.total_users_count", { count: total })}
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor="per-page" className="text-sm text-gray-600">
                    {t("pagination.items_per_page")}
                </label>
                <select
                    id="per-page"
                    value={String(pageSize)}
                    onChange={(e) => setParams({ per: e.target.value, page: "1" })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                    {[5, 10, 20].map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
