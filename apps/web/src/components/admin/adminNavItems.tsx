import { Settings, Timer, UsersRound } from "lucide-react";
import type { SidebarItem } from "@/components/ui/Sidebar";

/** Build the nav item list for the admin sidebar. */
export function getAdminNavItems(t: (key: string) => string, locale: string): SidebarItem[] {
    const base = `/${locale}/admin`;
    return [
        {
            label: t("items.users"),
            href: `${base}/users`,
            icon: <UsersRound className="h-4 w-4" aria-hidden />,
            section: t("sections.manage"),
        },
        {
            label: t("items.widgets"),
            href: `${base}/widgets`,
            icon: <Timer className="h-4 w-4" aria-hidden />,
            section: t("sections.manage"),
        },
        {
            label: t("items.settings"),
            href: `${base}/settings`,
            icon: <Settings className="h-4 w-4" aria-hidden />,
            section: t("sections.system"),
        },
    ];
}
