import PageWrapper from "@/components/page-wrapper";

export default function Home() {
  return (
    <PageWrapper
      headerVariant="transparent"
      headerMode="fixed"
      className="overflow-hidden bg-gradient-to-br from-purple-600 via-blue-500 to-teal-400"
    >
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-white">
          <h1 className="mb-4 text-5xl font-bold">The Hub</h1>
          <p className="text-lg">Kjeft a</p>
        </div>
      </div>
    </PageWrapper>
  );
}
