import { defineRouting } from "next-intl/routing";

export const LOCALES = ["en", "no"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "no";

export const routing = defineRouting({
    // defineRouting expects a (mutable) string[], so spread the tuple:
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "always",
});

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

export const NEXT_LOCALE: Record<Locale, Locale> = { en: "no", no: "en" };
