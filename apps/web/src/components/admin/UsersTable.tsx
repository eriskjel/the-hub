"use client";

import { TableComponent } from "nextjs-reusable-table";
import "nextjs-reusable-table/dist/index.css";
import React, { ReactElement, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProfileWithAuth } from "@/types/users";
import { RoleBadge } from "@/components/admin/RoleBadge";
import type { RoleKey } from "@/lib/auth/role";

type Row = {
    id: string;
    name: string;
    email: string;
    roleKey: RoleKey;
};

export default function UsersTable({
    users,
    pageSize,
}: {
    users: ProfileWithAuth[];
    pageSize?: number;
}): ReactElement {
    const t = useTranslations("admin.users");

    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(pageSize);

    const columns = useMemo(
        () => [
            t("columns.id"),
            t("columns.name"),
            t("columns.email"),
            t("columns.role"),
            t("columns.actions"),
        ],
        [t]
    );

    const data: Row[] = useMemo(
        () =>
            users.map((u) => ({
                id: u.id,
                name: u.full_name ?? u.username ?? "—",
                email: u.auth.email,
                roleKey: u.auth.effective_role,
            })),
        [users]
    );

    const customClassNames = {
        table: "w-full bg-white text-gray-900",
        tbody: "divide-y divide-gray-200",

        thead: "border-b border-gray-300",
        th: "px-6 py-4 text-left text-sm font-semibold text-gray-700",

        // keep cells transparent so row bg shows through
        td: "px-6 py-4 text-left text-sm text-gray-900 !bg-transparent",

        // zebra striping + hover override
        tr: "group odd:!bg-white even:!bg-gray-50 hover:!bg-slate-100 transition-colors cursor-pointer",
    };

    return (
        <div className="space-y-4 [&_thead_tr]:!bg-gray-200">
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    {t("pagination.total_users", { default: "Total:" })} {users.length}
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="per-page" className="text-sm text-gray-600">
                        {t("pagination.items_per_page", { default: "Items per page:" })}
                    </label>
                    <select
                        id="per-page"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setPage(1); // reset when page size changes
                        }}
                        className="rounded border border-gray-300 p-1"
                    >
                        {[5, 10, 20, 25, 50].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <TableComponent<Row>
                columns={columns}
                data={data}
                props={["id", "name", "email", "roleKey"] as const}
                loading={false}
                disableDefaultStyles={false}
                enableDarkMode={false}
                customClassNames={customClassNames}
                enablePagination
                page={page}
                setPage={setPage}
                itemsPerPage={itemsPerPage}
                renderRow={(row: Row) => (
                    <>
                        <td className="px-6 py-4 text-left text-sm">{row.id}</td>
                        <td className="px-6 py-4 text-left text-sm">{row.name}</td>
                        <td className="px-6 py-4 text-left text-sm">{row.email}</td>
                        <td className="px-6 py-4 text-left text-sm">
                            <RoleBadge role={row.roleKey} />
                        </td>
                        <td className="px-6 py-4 text-left text-sm">
                            <div className="inline-flex gap-2">
                                <button className="rounded bg-blue-600 px-3 py-1 text-white">
                                    {t("actions.edit")}
                                </button>
                                <button className="rounded bg-red-600 px-3 py-1 text-white">
                                    {t("actions.delete")}
                                </button>
                            </div>
                        </td>
                    </>
                )}
            />
        </div>
    );
}
