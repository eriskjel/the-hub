import { ReactNode } from "react";
import PageWrapper from "@/components/PageWrapper";
import { setRequestLocale } from "next-intl/server";

export default async function DashboardSectionLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    setRequestLocale(locale);

    return (
        <PageWrapper
            headerVariant="transparent"
            headerMode="fixed"
            className="dashboard-gradient relative overflow-hidden"
        >
            {children}
        </PageWrapper>
    );
}
