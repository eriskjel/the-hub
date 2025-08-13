import PageWrapper from "@/components/page-wrapper";

export default function LoginPage() {
  return (
    <PageWrapper className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Login</h1>
        <p className="text-lg">Please sign in to continue</p>
      </div>
    </PageWrapper>
  );
}
