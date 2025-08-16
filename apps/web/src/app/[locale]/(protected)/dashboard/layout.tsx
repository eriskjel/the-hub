import { ReactNode } from "react";
import PageWrapper from "@/components/PageWrapper";

export const dynamic = "force-dynamic";

export default function DashboardSectionLayout({ children }: { children: ReactNode }) {
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
