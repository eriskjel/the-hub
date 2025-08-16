import { ReactNode } from "react";
import Header from "@/components/Header";

type Props = {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    headerVariant?: "transparent" | "solid";
    headerMode?: "fixed" | "sticky";
};

export default function PageWrapper({
    children,
    className = "",
    contentClassName = "",
    headerVariant = "solid",
    headerMode = "fixed",
}: Props) {
    const minH =
        headerMode === "fixed"
            ? "min-h-dvh" // full viewport; header overlays
            : "min-h-[calc(100dvh-4rem)]"; // subtract sticky header height (h-16)

    const base = "mt-10";

    return (
        <section className={`flex w-full flex-col ${minH} ${className}`}>
            <Header variant={headerVariant} mode={headerMode} />
            <div
                className={`${base} ${
                    headerMode === "fixed" ? "flex-1 pt-16" : "flex-1"
                } ${contentClassName}`}
            >
                {children}
            </div>
        </section>
    );
}
