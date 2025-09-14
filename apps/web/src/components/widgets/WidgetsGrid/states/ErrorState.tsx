"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";

export default function ErrorState({ error }: { error: string }): ReactElement {
    const t = useTranslations("dashboard.states");

    const body = process.env.NODE_ENV === "development" ? error : t("errorBody");

    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center">
                <div className="inline-block rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                    <h3 className="mb-2 text-lg font-semibold">{t("errorTitle")}</h3>
                    <p className="text-sm">{body}</p>
                    <p className="mt-2 text-xs text-red-400">{t("errorTryRefresh")}</p>
                </div>
            </div>
        </section>
    );
}
