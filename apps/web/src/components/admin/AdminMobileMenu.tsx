"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Sidebar, { type SidebarLinkProps } from "@/components/ui/Sidebar";
import { getAdminNavItems } from "@/components/admin/adminNavItems";
import { cn } from "@/utils/cn";
import type { ComponentType } from "react";

const TypedLink = Link as ComponentType<SidebarLinkProps>;
const MENU_ID = "admin-mobile-menu";

export default function AdminMobileMenu() {
    const t = useTranslations("admin");
    const pathname = usePathname();
    const { locale } = useParams() as { locale: string };
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const items = useMemo(() => getAdminNavItems(t, locale), [t, locale]);

    return (
        <>
            {open && (
                <div
                    className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/50"
                    aria-hidden
                    onClick={() => setOpen(false)}
                />
            )}

            <aside
                id={MENU_ID}
                aria-hidden={!open}
                inert={!open}
                className={cn(
                    "border-border bg-surface fixed top-16 bottom-0 left-0 z-50 flex w-60 flex-col border-r transition-transform duration-200",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {open && (
                    <Sidebar
                        items={items}
                        currentPath={pathname ?? ""}
                        ariaLabel={t("nav.label")}
                        LinkComponent={TypedLink}
                    />
                )}
            </aside>

            <button
                className="bg-surface border-border text-foreground fixed bottom-5 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg"
                onClick={() => setOpen((o) => !o)}
                aria-label={t("nav.toggleMobile")}
                aria-expanded={open}
                aria-controls={MENU_ID}
            >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
        </>
    );
}
