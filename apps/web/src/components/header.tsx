import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/actions/auth";
import { getLocale, getTranslations } from "next-intl/server";
import { ReactElement } from "react";

type HeaderProps = {
  variant?: "transparent" | "solid";
  mode?: "fixed" | "sticky";
};

export default async function Header({ variant = "solid", mode = "sticky" }: HeaderProps) {
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
      <nav className="flex h-full items-center justify-center px-8">
        <ul className="flex gap-8">
          <li>
            <Link href="/" className="hover:text-gray-300">
              {t("header.home")}
            </Link>
          </li>
          <NavAuth isLoggedIn={!!user} t={t} />
        </ul>
      </nav>
    </header>
  );
}

type NavAuthProps = {
  isLoggedIn: boolean;
  t: (key: string) => string;
};

function NavAuth({ isLoggedIn, t }: NavAuthProps): ReactElement {
  if (isLoggedIn) {
    return (
      <li>
        <form action={logout}>
          <button className="cursor-pointer hover:text-gray-300" aria-label="Log out">
            {t("header.logout")}
          </button>
        </form>
      </li>
    );
  }

  return (
    <li>
      <Link href="/login" className="hover:text-gray-300">
        {t("header.login")}
      </Link>
    </li>
  );
}
