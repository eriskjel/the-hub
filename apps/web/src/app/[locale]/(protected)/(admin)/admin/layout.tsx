import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import PageWrapper from "@/components/PageWrapper";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    await requireAdmin(locale);

    return (
        <PageWrapper
            headerVariant="solid"
            headerMode="fixed"
            className="bg-gray-50 text-gray-900"
            contentClassName="mx-auto max-w-6xl p-4"
        >
            {children}
        </PageWrapper>
    );
}
