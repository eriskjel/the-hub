"use client";

import Sidebar, { type SidebarItem } from "@/components/ui/Sidebar";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReactElement, ReactNode } from "react";
import { Boxes, Settings, UsersRound } from "lucide-react";

export default function AdminSidebarClient(): ReactElement {
    const t = useTranslations();
    const pathname = usePathname();
    const { locale } = useParams() as { locale: string };

    const base = `/${locale}/admin`;
    const items: SidebarItem[] = [
        {
            label: "Users",
            href: `${base}/users`,
            icon: <UsersRound className="h-5 w-5" aria-hidden />,
            section: "Manage",
        },
        {
            label: "Widgets",
            href: `${base}/widgets`,
            icon: <Boxes className="h-5 w-5" aria-hidden />,
            section: "Manage",
        },
        {
            label: "Settings",
            href: `${base}/settings`,
            icon: <Settings className="h-5 w-5" aria-hidden />,
            section: "System",
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
