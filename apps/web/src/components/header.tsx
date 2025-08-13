import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 bg-black/20 backdrop-blur">
      <nav className="flex h-full items-center justify-center px-8">
        <ul className="flex gap-8">
          <li>
            <Link href="/" className="text-white transition hover:text-gray-300">
              Home
            </Link>
          </li>
          <li>
            <Link href="/kjeft" className="text-white transition hover:text-gray-300">
              Kjeft a
            </Link>
          </li>
          <li>
            <Link href="/login" className="text-white transition hover:text-gray-300">
              Logg inn
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
