import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import Header from "@/components/Header";
import AdminSidebarClient from "@/components/admin/AdminSidebarClient";
import AdminMobileMenu from "@/components/admin/AdminMobileMenu";

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
        <>
            <Header variant="solid" mode="fixed" />
            {/* Fixed sidebar — position:fixed, never participates in page layout */}
            <AdminSidebarClient />
            {/* Content area. Padding handled by .admin-content in globals.css */}
            <main className="admin-content">{children}</main>
            {/* Mobile overlay — visibility handled by .admin-mobile in globals.css */}
            <div className="admin-mobile">
                <AdminMobileMenu />
            </div>
        </>
    );
}
