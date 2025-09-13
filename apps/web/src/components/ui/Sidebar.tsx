"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type SidebarItem = {
    label: string;
    href: string;
    icon?: ReactNode; // if omitted, no dot shown (we keep spacing)
    badge?: number | string;
    section?: string;
};

export type SidebarProps = {
    items: SidebarItem[];
    currentPath?: string;
    LinkComponent?: ComponentType<{
        href: string;
        className?: string;
        children?: ReactNode;
        onClick?: () => void;
    }>;
    onNavigate?: (href: string) => void;
};

const SIDEBAR_WIDTH = 288;

export default function Sidebar({
    items,
    currentPath = "",
    LinkComponent,
    onNavigate,
}: SidebarProps) {
    // group by section
    const map = new Map<string | undefined, SidebarItem[]>();
    for (const it of items) {
        const key = it.section;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
    }

    function LinkOrButton({
        href,
        className,
        children,
    }: {
        href: string;
        className?: string;
        children: ReactNode;
    }) {
        if (LinkComponent)
            return (
                <LinkComponent href={href} className={className}>
                    {children}
                </LinkComponent>
            );
        if (onNavigate)
            return (
                <button onClick={() => onNavigate(href)} className={className}>
                    {children}
                </button>
            );
        return (
            <a href={href} className={className}>
                {children}
            </a>
        );
    }

    return (
        <aside
            role="navigation"
            aria-label="Sidebar"
            style={{ width: SIDEBAR_WIDTH }}
            className="not-prose border-border/60 relative z-20 flex h-full flex-col overflow-hidden border-r bg-[var(--sidebar-bg,theme(colors.gray.50))] text-[var(--sidebar-fg,theme(colors.gray.900))]"
        >
            <div className="px-2 pt-10 pb-2">
                {[...map.entries()].map(([section, list]) => (
                    <div key={section ?? "_root"} className="mb-2">
                        {section && (
                            <div className="text-foreground/60 px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                                {section}
                            </div>
                        )}
                        <ul className="m-0 !list-none space-y-1 pl-0">
                            {list.map((it) => {
                                const active =
                                    currentPath === it.href ||
                                    currentPath.startsWith(it.href + "/");
                                return (
                                    <li key={it.href}>
                                        <LinkOrButton
                                            href={it.href}
                                            className={cn(
                                                "group/nav flex w-full items-center gap-4 rounded-md px-3 py-3.5 text-base transition outline-none",
                                                active
                                                    ? "bg-blue-100 text-blue-900"
                                                    : "hover:bg-gray-100"
                                            )}
                                            {...(active ? { "aria-current": "page" } : {})}
                                        >
                                            {/* icon (or spacer to keep labels aligned) */}
                                            {it.icon ? (
                                                <span
                                                    className="grid h-5 w-5 place-items-center opacity-80"
                                                    aria-hidden
                                                >
                                                    {it.icon}
                                                </span>
                                            ) : (
                                                <span className="h-5 w-5" aria-hidden />
                                            )}

                                            <span
                                                className={cn(
                                                    "min-w-0 flex-1 truncate text-left",
                                                    active ? "font-medium" : ""
                                                )}
                                            >
                                                {it.label}
                                            </span>
                                        </LinkOrButton>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </aside>
    );
}
