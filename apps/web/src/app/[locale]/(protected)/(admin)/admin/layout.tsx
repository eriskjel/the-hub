import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import PageWrapper from "@/components/PageWrapper";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import AdminSidebarClient from "@/components/admin/AdminSidebarClient";

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
            contentClassName="max-w-none p-0 flex flex-1"
        >
            <div className="flex flex-1 overflow-hidden">
                <AdminSidebarClient />
                <main className="min-w-0 flex-1 overflow-auto p-4">{children}</main>
            </div>
        </PageWrapper>
    );
}
