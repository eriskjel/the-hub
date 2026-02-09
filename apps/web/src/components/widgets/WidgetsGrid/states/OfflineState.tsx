"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";

export default function OfflineState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center">
                <div className="widget-glass rounded-2xl p-8">
                    <h3 className="text-foreground mb-2 text-lg font-semibold">
                        {t("offlineTitle")}
                    </h3>
                    <p className="text-muted text-sm">{t("offlineBody")}</p>
                </div>
            </div>
        </section>
    );
}
