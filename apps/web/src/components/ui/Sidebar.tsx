"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type SidebarItem = {
    label: string;
    href: string;
    icon?: ReactNode;
    badge?: number | string;
    section?: string;
};

/** Prop shape expected by Sidebar's LinkComponent. Cast Next.js Link to this when typedRoutes is on. */
export type SidebarLinkProps = {
    href: string;
    className?: string;
    children?: ReactNode;
    onClick?: () => void;
};

export type SidebarProps = {
    items: SidebarItem[];
    currentPath?: string;
    /** When true, labels and section headers are hidden (icon-only mode). */
    collapsed?: boolean;
    ariaLabel?: string;
    LinkComponent?: ComponentType<SidebarLinkProps>;
};

export default function Sidebar({
    items,
    currentPath = "",
    collapsed = false,
    ariaLabel,
    LinkComponent,
}: SidebarProps) {
    const map = new Map<string | undefined, SidebarItem[]>();
    for (const it of items) {
        const key = it.section;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
    }

    // Defined outside render so it's stable — avoids remounting links on every
    // parent re-render (usePathname changes).
    const Anchor = LinkComponent ?? FallbackAnchor;

    return (
        <nav aria-label={ariaLabel} className="text-foreground flex flex-1 flex-col">
            <div className="flex-1 overflow-x-hidden overflow-y-auto px-2 pt-4 pb-2">
                {[...map.entries()].map(([section, list]) => (
                    <div key={section ?? "_root"} className="mb-2">
                        {section && !collapsed && (
                            <div className="text-muted px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                                {section}
                            </div>
                        )}
                        {section && collapsed && <div className="border-border my-2 border-t" />}
                        <ul className="m-0 !list-none space-y-0.5 pl-0">
                            {list.map((it) => {
                                const active =
                                    currentPath === it.href ||
                                    currentPath.startsWith(it.href + "/");
                                return (
                                    <li key={it.href}>
                                        <Anchor
                                            href={it.href}
                                            className={cn(
                                                "focus-visible:ring-primary flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors outline-none focus-visible:ring-2",
                                                collapsed && "justify-center",
                                                active
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-muted hover:bg-surface-light hover:text-foreground"
                                            )}
                                            {...(active ? { "aria-current": "page" } : {})}
                                        >
                                            {it.icon && (
                                                <span
                                                    className="grid h-5 w-5 shrink-0 place-items-center"
                                                    aria-hidden
                                                    title={collapsed ? it.label : undefined}
                                                >
                                                    {it.icon}
                                                </span>
                                            )}
                                            {!collapsed && (
                                                <span className="min-w-0 flex-1 truncate">
                                                    {it.label}
                                                </span>
                                            )}
                                            {!collapsed && it.badge != null && (
                                                <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px]">
                                                    {it.badge}
                                                </span>
                                            )}
                                        </Anchor>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}

function FallbackAnchor({
    href,
    className,
    children,
    onClick,
    ...rest
}: {
    href: string;
    className?: string;
    children?: ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
}) {
    return (
        <a href={href} className={className} onClick={onClick} {...rest}>
            {children}
        </a>
    );
}
