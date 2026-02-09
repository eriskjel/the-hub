"use client";

import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTypedLocale } from "@/i18n/useTypedLocale";
import { type Locale, NEXT_LOCALE } from "@/i18n/routing";
import { User, LogOut, Languages } from "lucide-react";
import { logout } from "@/app/auth/actions/auth";

type UserMenuProps = {
    isLoggedIn: boolean;
    logoutLabel: string;
};

export default function UserMenu({ isLoggedIn, logoutLabel }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const locale = useTypedLocale();
    const nextLocale: Locale = NEXT_LOCALE[locale];
    const pathname = usePathname();
    const qs = useSearchParams().toString();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [open]);

    if (!mounted) return null;

    const localeHref = `${pathname || "/"}${qs ? `?${qs}` : ""}`;
    const switchLabel = nextLocale === "en" ? "Switch to English" : "Bytt til norsk";

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="true"
                aria-label="User menu"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-white/10 focus:ring-2 focus:ring-white/40 focus:outline-none"
            >
                <User className="h-5 w-5 text-white" aria-hidden />
            </button>

            {open && (
                <div
                    role="menu"
                    className="border-border bg-surface absolute top-full right-0 mt-2 w-44 origin-top-right rounded-xl border py-1 shadow-lg"
                >
                    {/* Language toggle */}
                    <Link
                        href={localeHref}
                        locale={nextLocale}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="text-foreground hover:bg-surface-subtle flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    >
                        <Languages className="text-muted h-4 w-4" aria-hidden />
                        <span>{switchLabel}</span>
                    </Link>

                    {/* Logout - only show if logged in */}
                    {isLoggedIn && (
                        <>
                            <div className="bg-border my-1 h-px" />
                            <form action={logout}>
                                <button
                                    type="submit"
                                    role="menuitem"
                                    onClick={() => setOpen(false)}
                                    className="text-foreground hover:bg-surface-subtle flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                                >
                                    <LogOut className="text-muted h-4 w-4" aria-hidden />
                                    <span>{logoutLabel}</span>
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
