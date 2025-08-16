import PageWrapper from "@/components/PageWrapper";
import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
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
            headerVariant="solid"
            headerMode="sticky"
            className="bg-white text-black"
            contentClassName="flex justify-center"
        >
            {children}
        </PageWrapper>
    );
}
