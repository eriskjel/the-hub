import { ReactNode } from "react";
import PageWrapper from "@/components/page-wrapper";

export default function MonsterLayout({ children }: { children: ReactNode }) {
    return (
        <PageWrapper
            headerVariant="solid"
            headerMode="fixed"
            className="overflow-hidden"
        >
            {children}
        </PageWrapper>
    );
}
