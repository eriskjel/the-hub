"use client";

import { useTranslations } from "next-intl";

export default function Loading() {
    const t = useTranslations("admin");
    return (
        <div
            role="status"
            aria-label={t("loading")}
            className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-10"
        >
            <span className="sr-only">{t("loading")}</span>
            <div aria-hidden="true" className="space-y-3">
                <div className="bg-border h-9 w-48 rounded motion-safe:animate-pulse" />
                <div className="bg-border h-4 w-full max-w-lg rounded motion-safe:animate-pulse" />
            </div>
            <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
                {[0, 1].map((key) => (
                    <div key={key} className="border-border bg-surface h-64 rounded-2xl border p-6">
                        <div className="bg-border h-full rounded-xl motion-safe:animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}
