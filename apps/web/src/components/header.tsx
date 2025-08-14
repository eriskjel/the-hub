import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/actions/auth";

type HeaderProps = {
  variant?: "transparent" | "solid";
  mode?: "fixed" | "sticky";
};

export default async function Header({ variant = "solid", mode = "sticky" }: HeaderProps) {
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
              Home
            </Link>
          </li>
          <NavAuth isLoggedIn={!!user} />
        </ul>
      </nav>
    </header>
  );
}

type NavAuthProps = {
  isLoggedIn: boolean;
};

function NavAuth({ isLoggedIn }: NavAuthProps) {
  if (isLoggedIn) {
    return (
      <li>
        <form action={logout}>
          <button className="cursor-pointer hover:text-gray-300">Logg ut</button>
        </form>
      </li>
    );
  }

  return (
    <li>
      <Link href="/login" className="hover:text-gray-300">
        Logg inn
      </Link>
    </li>
  );
}
