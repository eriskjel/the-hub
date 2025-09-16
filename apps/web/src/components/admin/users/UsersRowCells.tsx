"use client";

import type { ReactElement } from "react";
import { RoleBadge } from "@/components/admin/RoleBadge";
import type { RoleKey } from "@/lib/auth/role";
import UsersRowActions from "./UsersRowActions";

export type UsersRow = { id: string; name: string; email: string; roleKey: RoleKey };

export default function UsersRowCells(row: UsersRow): ReactElement {
    return (
        <>
            <td className="px-6 py-4 text-left text-sm">{row.id}</td>
            <td className="px-6 py-4 text-left text-sm">{row.name}</td>
            <td className="px-6 py-4 text-left text-sm">{row.email}</td>
            <td className="px-6 py-4 text-left text-sm">
                <RoleBadge role={row.roleKey} />
            </td>
            <td className="px-6 py-4 text-left text-sm" onClick={(e) => e.stopPropagation()}>
                <UsersRowActions id={row.id} />
            </td>
        </>
    );
}
