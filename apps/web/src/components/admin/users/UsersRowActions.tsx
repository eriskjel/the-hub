"use client";

import React from "react";
import { useTranslations } from "next-intl";

export default function UsersRowActions({ id }: { id: string }) {
    const t = useTranslations("admin.users.actions");
    const [open, setOpen] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement | null>(null);

    React.useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!open) return;
            const t = e.target as Node;
            if (btnRef.current && !btnRef.current.contains(t)) {
                const panel = document.getElementById(`menu-${id}`);
                if (panel && !panel.contains(t)) setOpen(false);
            }
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [open, id]);

    return (
        <div className="relative inline-block text-left">
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                className="rounded p-1 hover:bg-gray-200"
            >
                ⋮
            </button>

            {open && (
                <div
                    id={`menu-${id}`}
                    role="menu"
                    aria-labelledby={`menu-button-${id}`}
                    className="absolute right-0 z-10 mt-2 w-40 rounded-md border bg-white shadow-md focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                        {t("edit")}
                    </button>
                    <button
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                        {t("delete")}
                    </button>
                </div>
            )}
        </div>
    );
}
