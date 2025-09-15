"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";

export default function OfflineState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center text-neutral-300">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                    <h3 className="mb-2 text-lg font-semibold">{t("offlineTitle")}</h3>
                    <p className="text-sm text-neutral-400">{t("offlineBody")}</p>
                </div>
            </div>
        </section>
    );
}
