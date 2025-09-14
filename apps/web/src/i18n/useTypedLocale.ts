"use client";
import { useLocale as useNextIntlLocale } from "next-intl";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./routing";

export function useTypedLocale(): Locale {
    const l = useNextIntlLocale();
    return isLocale(l) ? l : DEFAULT_LOCALE;
}
