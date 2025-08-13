export default function Header() {
    return (
        <header className="absolute top-0 left-0 w-full z-10">
            <nav className="flex justify-center items-center px-8 py-4">
                <ul className="flex gap-8">
                    <li><a href="#" className="text-white hover:text-gray-300 transition">Home</a></li>
                    <li><a href="#" className="text-white hover:text-gray-300 transition">Kjeft a</a></li>
                    <li><a href="#" className="text-white hover:text-gray-300 transition">Logg inn</a></li>
                </ul>
            </nav>
        </header>
    );
}
