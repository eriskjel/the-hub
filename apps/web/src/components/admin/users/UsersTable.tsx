"use client";

import { TableComponent } from "nextjs-reusable-table";
import "nextjs-reusable-table/dist/index.css";
import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProfileWithAuth } from "@/types/users";

import { pickDisplayName } from "@/lib/auth/pickDisplayName";
import { UsersPagination } from "@/components/admin/users/Pagination";
import { useRouter } from "@/i18n/navigation";
import { useQueryNav } from "@/hooks/useQueryNav";
import UsersRowCells, { UsersRow } from "@/components/admin/users/UsersRowCells";
import UsersTopBar from "@/components/admin/users/UsersTopBar";

export default function UsersTable({
    users,
    page,
    pageSize,
    total,
}: {
    users: ProfileWithAuth[];
    page: number;
    pageSize: number;
    total: number;
}): ReactElement {
    const t = useTranslations("admin.users");
    const router = useRouter();
    const { setParams } = useQueryNav();
    const [isNavigating, setIsNavigating] = useState(false);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

    const data: UsersRow[] = useMemo(
        () =>
            users.map((u) => ({
                id: u.id,
                name: pickDisplayName(u),
                email: u.auth.email,
                roleKey: u.auth.effective_role,
            })),
        [users]
    );

    useEffect(() => {
        setIsNavigating(false);
    }, [users]);

    const classes = {
        table: "w-full bg-white text-gray-900",
        tbody: "divide-y divide-gray-200",
        thead: "border-b border-gray-300",
        th: "px-6 py-4 text-left text-sm font-semibold text-gray-700",
        td: "px-6 py-4 text-left text-sm text-gray-900 !bg-transparent",
        tr: "group odd:bg-white even:bg-gray-50 hover:!bg-slate-100 transition-colors cursor-pointer",
        pagination: {
            container: "flex items-center justify-between mt-4 gap-3",
            button: "px-3 py-1 rounded-md bg-white text-gray-700 hover:bg-gray-50 border",
            buttonDisabled: "opacity-50 cursor-not-allowed",
            pageInfo: "text-sm text-gray-700",
        },
    };

    return (
        <div className="space-y-4 [&_thead_tr]:!bg-gray-200">
            <UsersTopBar total={total} pageSize={pageSize} />

            <TableComponent<UsersRow>
                columns={columns}
                data={data}
                props={["id", "name", "email", "roleKey"] as const}
                loading={isNavigating}
                disableDefaultStyles={false}
                enableDarkMode={false}
                customClassNames={classes}
                enablePagination
                page={page}
                setPage={(p) => {
                    setIsNavigating(true);
                    setParams({ page: String(p) });
                }}
                itemsPerPage={pageSize}
                totalPages={totalPages}
                renderPagination={(p) => (
                    <UsersPagination page={p.page} setPage={p.setPage} totalPages={totalPages} />
                )}
                rowOnClick={(row) => router.push(`/admin/users/${row.id}`)}
                renderRow={(row) => <UsersRowCells {...row} />}
            />
        </div>
    );
}
