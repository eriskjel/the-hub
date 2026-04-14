"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Sidebar, { type SidebarLinkProps } from "@/components/ui/Sidebar";
import { getAdminNavItems } from "@/components/admin/adminNavItems";
import { cn } from "@/utils/cn";
import type { ComponentType } from "react";

const EXPANDED_W = "15rem"; // matches w-60
const COLLAPSED_W = "3.5rem"; // matches w-14
const STORAGE_KEY = "admin-sidebar-collapsed";

const TypedLink = Link as ComponentType<SidebarLinkProps>;

export default function AdminSidebarClient() {
    const t = useTranslations("admin");
    const pathname = usePathname();
    const { locale } = useParams() as { locale: string };
    const [collapsed, setCollapsed] = useState(false);

    // Restore persisted state after mount (avoids SSR hydration mismatch).
    useEffect(() => {
        try {
            if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
        } catch {
            // storage unavailable (private mode, quota, etc.) — fall back to default
        }
    }, []);

    // Keep the CSS variable in sync so .admin-content padding-left follows.
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--admin-sidebar-w",
            collapsed ? COLLAPSED_W : EXPANDED_W
        );
    }, [collapsed]);

    function toggle() {
        const next = !collapsed;
        setCollapsed(next);
        try {
            localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
            // storage unavailable — state still toggles for this session
        }
    }

    const items = useMemo(() => getAdminNavItems(t, locale), [t, locale]);

    return (
        <aside
            className={cn(
                "admin-sidebar border-border bg-surface fixed top-16 bottom-0 left-0 z-20 flex-col border-r transition-[width] duration-200",
                collapsed ? "w-14" : "w-60"
            )}
        >
            <Sidebar
                items={items}
                currentPath={pathname ?? ""}
                collapsed={collapsed}
                ariaLabel={t("nav.label")}
                LinkComponent={TypedLink}
            />
            <div className="border-border border-t p-2">
                <button
                    onClick={toggle}
                    aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
                    className={cn(
                        "text-muted hover:bg-surface-light hover:text-foreground flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                        collapsed && "justify-center"
                    )}
                >
                    {collapsed ? (
                        <PanelLeftOpen className="h-4 w-4 shrink-0" />
                    ) : (
                        <>
                            <PanelLeftClose className="h-4 w-4 shrink-0" />
                            <span>{t("nav.collapse")}</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
