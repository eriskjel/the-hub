import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  offsetHeader?: boolean;
};

export default function PageWrapper({ children, className = "", offsetHeader = true }: Props) {
  const base: string = offsetHeader
    ? "min-h-[calc(100dvh-4rem)] w-full" // header is h-16 (4rem)
    : "min-h-dvh w-full";

  return <section className={`${base} ${className}`}>{children}</section>;
}
