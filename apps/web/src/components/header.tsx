import Link from "next/link";

type HeaderProps = {
  variant?: "transparent" | "solid";
  mode?: "fixed" | "sticky"; // NEW
};

export default function Header({ variant = "solid", mode = "sticky" }: HeaderProps) {
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
          <li>
            <Link href="/login" className="hover:text-gray-300">
              Logg inn
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
