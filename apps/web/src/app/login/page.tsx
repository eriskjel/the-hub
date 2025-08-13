import PageWrapper from "@/components/page-wrapper";

export default function LoginPage() {
  return (
    <PageWrapper
      headerVariant="solid"
      headerMode="sticky"
      className="bg-white text-black"
    >
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Login</h1>
          <p className="text-lg">Please sign in to continue</p>
        </div>
      </div>
    </PageWrapper>
  );
}
