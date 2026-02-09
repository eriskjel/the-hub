"use client";

import type { ReactElement } from "react";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";
import { useTranslations } from "next-intl";

export default function EmptyState(): ReactElement {
    const t = useTranslations("dashboard.states");

    return (
        <section className="py-1">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                <CreateWidgetButton />
                <div className="widget-glass w-full rounded-2xl p-8">
                    <h3 className="text-foreground mb-2 text-lg font-semibold">
                        {t("emptyTitle")}
                    </h3>
                    <p className="text-muted text-sm">{t("emptyBody")}</p>
                </div>
            </div>
        </section>
    );
}
