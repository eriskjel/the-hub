// app/(public)/layout.tsx
import PageWrapper from "@/components/page-wrapper";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PageWrapper headerVariant="solid" headerMode="sticky" className="bg-white text-black">
      {children}
    </PageWrapper>
  );
}
