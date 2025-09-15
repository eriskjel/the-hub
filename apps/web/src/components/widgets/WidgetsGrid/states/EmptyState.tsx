"use client";

import type { ReactElement } from "react";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";
import { useTranslations } from "next-intl";

export default function EmptyState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-1">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center text-neutral-300">
                <CreateWidgetButton />
                <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                    <h3 className="mb-2 text-lg font-semibold">{t("emptyTitle")}</h3>
                    <p className="text-sm text-neutral-400">{t("emptyBody")}</p>
                </div>
            </div>
        </section>
    );
}
