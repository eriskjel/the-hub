import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/actions/auth";
import { getLocale, getTranslations } from "next-intl/server";
import { ReactElement } from "react";
import { isAdminFromUser } from "@/lib/auth/isAdmin";
import LocaleToggle from "@/components/LocaleToggle";
import ThemeToggle from "@/components/ThemeToggle";

type HeaderProps = {
    variant?: "transparent" | "solid";
    mode?: "fixed" | "sticky";
};

export default async function Header({ variant = "solid", mode = "sticky" }: HeaderProps) {
    // getLocale() works because setRequestLocale() is called in parent layouts
    const locale = await getLocale();
    const t = await getTranslations({ locale });
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

                {/* Right: theme toggle + locale flag */}
                <div className="absolute right-8 flex items-center gap-1">
                    <ThemeToggle />
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
    return isLoggedIn ? <AuthLinks isAdmin={isAdmin} t={t} /> : <GuestLinks t={t} />;
}

function AuthLinks({ isAdmin, t }: { isAdmin: boolean; t: (k: string) => string }): ReactElement {
    return (
        <>
            <li>
                <Link href="/dashboard" className="hover:text-gray-300">
                    {t("header.home")}
                </Link>
            </li>
            <li>
                <Link href="/monster" className="hover:text-gray-300">
                    {t("monster.pageTitle")}
                </Link>
            </li>
            {isAdmin && (
                <li>
                    <Link href="/admin" className="hover:text-gray-300">
                        {t("header.admin")}
                    </Link>
                </li>
            )}
            <li>
                <form action={logout}>
                    <button className="cursor-pointer hover:text-gray-300" aria-label="Log out">
                        {t("header.logout")}
                    </button>
                </form>
            </li>
        </>
    );
}

function GuestLinks({ t }: { t: (k: string) => string }): ReactElement {
    return (
        <>
            <li>
                <Link href="/login" className="hover:text-gray-300">
                    {t("header.home")}
                </Link>
            </li>
            <li>
                <Link href="/login" className="hover:text-gray-300">
                    {t("header.login")}
                </Link>
            </li>
        </>
    );
}
