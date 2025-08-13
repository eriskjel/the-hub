import Header from "@/components/header";

export default function Home() {
  return (
      <div className="relative h-screen w-screen bg-gradient-to-br from-purple-600 via-blue-500 to-teal-400 overflow-hidden">
        <Header />
        <main className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <h1 className="text-5xl font-bold mb-4">The Hub</h1>
            <p className="text-lg">Kjeft a</p>
          </div>
        </main>
      </div>
  );
}