"use client";

import type { ReactElement } from "react";
import { type RoleKey, roleKeyToI18n } from "@/lib/auth/role";
import { useTranslations } from "next-intl";

export function RoleBadge({ role }: { role: RoleKey }): ReactElement {
    const t = useTranslations("admin.users.roles");
    const label = t(roleKeyToI18n(role));
    const styles =
        role === "admin"
            ? "border-red-500 text-red-600"
            : role === "user"
              ? "border-gray-400 text-gray-600"
              : "border-slate-300 text-slate-500";

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${styles}`}
        >
            {label}
        </span>
    );
}
