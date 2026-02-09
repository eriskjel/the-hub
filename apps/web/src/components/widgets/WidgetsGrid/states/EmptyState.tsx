"use client";

import type { ReactElement } from "react";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";
import { useTranslations } from "next-intl";

export default function EmptyState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-1">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center text-white/80">
                <CreateWidgetButton />
                <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                    <h3 className="mb-2 text-lg font-semibold text-white">{t("emptyTitle")}</h3>
                    <p className="text-sm text-white/60">{t("emptyBody")}</p>
                </div>
            </div>
        </section>
    );
}
