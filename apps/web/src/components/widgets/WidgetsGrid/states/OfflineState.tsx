"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";

export default function OfflineState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center text-white/80">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                    <h3 className="mb-2 text-lg font-semibold text-white">{t("offlineTitle")}</h3>
                    <p className="text-sm text-white/60">{t("offlineBody")}</p>
                </div>
            </div>
        </section>
    );
}
