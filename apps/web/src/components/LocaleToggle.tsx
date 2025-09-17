"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTypedLocale } from "@/i18n/useTypedLocale";
import { type Locale, NEXT_LOCALE } from "@/i18n/routing";

export default function LocaleToggle() {
    const [isMounted, setIsMounted] = useState(false);
    const [showOnDesktop, setShowOnDesktop] = useState(false);

    const locale = useTypedLocale();
    const next: Locale = NEXT_LOCALE[locale];

    const pathname = usePathname();
    const qs = useSearchParams().toString();
    const href = `${pathname || "/"}${qs ? `?${qs}` : ""}`;

    const label = next === "en" ? "Switch to English" : "Bytt til norsk";
    const flagClass = next === "en" ? "fi fi-gb" : "fi fi-no";

    useEffect(() => {
        setIsMounted(true);

        const checkScreenSize = () => {
            setShowOnDesktop(window.innerWidth >= 640);
        };

        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);

        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    if (!isMounted || !showOnDesktop) {
        return null;
    }

    return (
        <Link
            href={href}
            locale={next}
            aria-label={label}
            title={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 focus:ring-2 focus:ring-white/40 focus:outline-none"
        >
            <span aria-hidden className={`${flagClass} text-xl leading-none`} />
        </Link>
    );
}
