import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import PageWrapper from "@/components/page-wrapper";

// ensure no caching of protected shell
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect(`/${locale}/login`);

  return (
    <PageWrapper
      headerVariant="transparent"
      headerMode="fixed"
      className="overflow-hidden bg-gradient-to-br from-purple-600 via-blue-500 to-teal-400"
    >
      {children}
    </PageWrapper>
  );
}
