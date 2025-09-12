"use client";

import Sidebar, { type SidebarItem } from "@/components/ui/Sidebar";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReactElement, ReactNode } from "react";
import { Boxes, Settings, UsersRound } from "lucide-react";

export default function AdminSidebarClient(): ReactElement {
    const t = useTranslations("admin");
    const pathname = usePathname();
    const { locale } = useParams() as { locale: string };

    const base = `/${locale}/admin`;
    const items: SidebarItem[] = [
        {
            label: t("items.users"),
            href: `${base}/users`,
            icon: <UsersRound className="h-5 w-5" aria-hidden />,
            section: t("sections.manage"),
        },
        {
            label: t("items.widgets"),
            href: `${base}/widgets`,
            icon: <Boxes className="h-5 w-5" aria-hidden />,
            section: t("sections.manage"),
        },
        {
            label: t("items.settings"),
            href: `${base}/settings`,
            icon: <Settings className="h-5 w-5" aria-hidden />,
            section: t("sections.system"),
        },
    ];

    return <Sidebar items={items} currentPath={pathname ?? ""} LinkComponent={NextLinkAdapter} />;
}

type LinkAdapterProps = { href: string; className?: string; children?: ReactNode };
function NextLinkAdapter({ href, className, children }: LinkAdapterProps): ReactElement {
    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}
