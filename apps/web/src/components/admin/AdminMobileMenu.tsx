"use client";

import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { getAdminNavItems } from "./adminNavItems";
import { cn } from "@/utils/cn";

export default function AdminMobileMenu() {
    const t = useTranslations("admin");
    const pathname = usePathname();
    const { locale } = useParams() as { locale: string };
    return (
        <nav
            aria-label={t("nav.label")}
            className="border-border bg-surface flex justify-center-safe gap-1 overflow-x-auto border-b px-4 py-3"
        >
            {getAdminNavItems(t, locale).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                    <Link
                        key={item.href}
                        href={{ pathname: item.href }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "focus-visible:ring-primary inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm focus-visible:ring-2",
                            active
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:bg-surface-subtle"
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
