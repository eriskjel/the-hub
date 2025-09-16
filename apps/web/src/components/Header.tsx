import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/actions/auth";
import { getTranslations } from "next-intl/server";
import { ReactElement } from "react";
import { isAdminFromUser } from "@/lib/auth/isAdmin";
import LocaleToggle from "@/components/LocaleToggle";

type HeaderProps = {
    variant?: "transparent" | "solid";
    mode?: "fixed" | "sticky";
};

export default async function Header({ variant = "solid", mode = "sticky" }: HeaderProps) {
    const t = await getTranslations();
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const position = mode === "fixed" ? "fixed" : "sticky";
    const base = `${position} top-0 z-50 h-16 w-full backdrop-blur-sm`;
    const look = variant === "transparent" ? "bg-black/10 text-white" : "bg-gray-900 text-white";

    return (
        <header className={`${base} ${look}`}>
            <nav className="relative flex h-full w-full items-center justify-center px-8">
                <ul className="flex gap-8">
                    <NavItems isLoggedIn={!!user} isAdmin={isAdminFromUser(user)} t={t} />
                </ul>

                {/* Right-only: locale flag */}
                <div className="absolute right-8 hidden items-center sm:flex">
                    <LocaleToggle />
                </div>
            </nav>
        </header>
    );
}

type NavAuthProps = {
    isLoggedIn: boolean;
    isAdmin: boolean;
    t: (key: string) => string;
};

function NavItems({ isLoggedIn, isAdmin, t }: NavAuthProps): ReactElement {
    type NavItem = { href: string; label: string } | { form: typeof logout; label: string };

    const items: NavItem[] = [
        { href: isLoggedIn ? "/dashboard" : "/login", label: t("header.home") },
    ];

    if (isLoggedIn) {
        items.push({ href: "/monster", label: t("monster.pageTitle") });
        if (isAdmin) items.push({ href: "/admin", label: t("header.admin") });
        items.push({ form: logout, label: t("header.logout") });
    } else {
        items.push({ href: "/login", label: t("header.login") });
    }

    return (
        <>
            {items.map((item, i) =>
                "form" in item ? (
                    <li key={i}>
                        <form action={item.form}>
                            <button className="hover:text-gray-300">{item.label}</button>
                        </form>
                    </li>
                ) : (
                    <li key={i}>
                        <Link href={item.href} className="hover:text-gray-300">
                            {item.label}
                        </Link>
                    </li>
                )
            )}
        </>
    );
}
