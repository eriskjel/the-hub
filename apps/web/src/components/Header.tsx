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
                <div className="absolute right-8 flex items-center">
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
    const homeHref = isLoggedIn ? "/dashboard" : "/login";

    if (isLoggedIn) {
        return (
            <>
                <li>
                    <Link href={homeHref} className="hover:text-gray-300">
                        {t("header.home")}
                    </Link>
                </li>
                <li>
                    <Link href="/monster" className="hover:text-gray-300">
                        {t("monster.pageTitle")}
                    </Link>
                </li>
                {/* Only show if user is admin */}
                {isAdmin && (
                    <li>
                        <Link href="/admin" className="hover:text-gray-300">
                            {t("header.admin") ?? "Admin"}
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

    return (
        <>
            <li>
                <Link href={homeHref} className="hover:text-gray-300">
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
