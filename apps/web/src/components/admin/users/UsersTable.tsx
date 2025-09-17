"use client";

import { TableComponent } from "nextjs-reusable-table";
import "nextjs-reusable-table/dist/index.css";
import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProfileWithAuth } from "@/types/users";

import { pickDisplayName } from "@/lib/auth/pickDisplayName";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { useRouter } from "@/i18n/navigation";
import { useQueryNav } from "@/hooks/useQueryNav";
import UsersRowCells, { UsersRow } from "@/components/admin/users/UsersRowCells";
import TableTopBar from "@/components/ui/TableTopBar";

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
    const totalPages: number = Math.max(1, Math.ceil(total / pageSize));

    const columns: string[] = useMemo(() => getUserTableColumns(t), [t]);

    const data: UsersRow[] = useMemo(() => mapUsersToRows(users), [users]);

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
            <TableTopBar
                total={total}
                pageSize={pageSize}
                totalLabel={(n) => t("pagination.total_users_count", { count: n })}
                perPageLabel={t("pagination.items_per_page")}
                onChangePerPage={(n) => setParams({ per: String(n), page: "1" })}
            />
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
                    <PaginationControls
                        page={p.page}
                        setPage={p.setPage}
                        totalPages={totalPages}
                        label={(page, total) => t("pagination.page_of", { page, total })}
                        prevLabel={t("pagination.prev")}
                        nextLabel={t("pagination.next")}
                    />
                )}
                rowOnClick={(row) => router.push(`/admin/users/${row.id}`)}
                renderRow={(row) => <UsersRowCells {...row} />}
            />
        </div>
    );
}

function getUserTableColumns(t: ReturnType<typeof useTranslations>): string[] {
    return [
        t("columns.id"),
        t("columns.name"),
        t("columns.email"),
        t("columns.role"),
        t("columns.actions"),
    ];
}

function mapUsersToRows(users: ProfileWithAuth[]): UsersRow[] {
    return users.map((user: ProfileWithAuth) => ({
        id: user.id,
        name: pickDisplayName(user),
        email: user.auth.email,
        roleKey: user.auth.effective_role,
    }));
}
