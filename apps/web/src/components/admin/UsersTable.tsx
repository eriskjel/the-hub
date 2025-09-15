"use client";

import { DataTable } from "@/components/ui/Table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";

import type { AdminUserRow, ProfileWithAuth } from "@/types/users";
import { toAdminUserRow } from "@/types/users";

export default function UsersTable({
    users,
    pageSize = 5,
}: {
    users: ProfileWithAuth[];
    pageSize?: number;
}) {
    const t = useTranslations("admin.users");

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

    // Adapt to flat rows for the table
    const rows = useMemo<AdminUserRow[]>(() => users.map(toAdminUserRow), [users]);

    // Client-side pagination (swap to server later if needed)
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const pageData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return rows.slice(start, start + pageSize);
    }, [rows, page, pageSize]);

    const visibleProps: (keyof AdminUserRow)[] = ["id", "name", "email", "role"];

    return (
        <DataTable<AdminUserRow>
            columns={columns}
            data={pageData}
            props={visibleProps}
            enablePagination
            page={page}
            setPage={setPage}
            itemsPerPage={pageSize}
            totalPages={totalPages}
            density="compact"
            renderRow={(r) => (
                <>
                    <td className="px-6 py-4">{r.id}</td>
                    <td className="px-6 py-4">
                        <Link href={`./users/${r.id}`} className="underline">
                            {r.name ?? "—"}
                        </Link>
                    </td>
                    <td className="px-6 py-4">{r.email}</td>
                    <td className="px-6 py-4">{r.role}</td>
                    <td className="px-6 py-4">
                        <div className="flex gap-2">
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
    );
}
