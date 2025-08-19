import { ReactNode } from "react";
import PageWrapper from "@/components/PageWrapper";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function MonsterLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <PageWrapper headerVariant="solid" headerMode="fixed" className="overflow-hidden">
            {children}
        </PageWrapper>
    );
}
