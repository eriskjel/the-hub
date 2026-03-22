"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export default function ErrorState({ error }: { error: string }): ReactElement {
    const t = useTranslations("dashboard.states");
    const router = useRouter();

    const body = process.env.NODE_ENV === "development" ? error : t("errorBody");

    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center">
                <div className="border-error-muted bg-error-subtle text-error inline-block rounded-lg border p-6">
                    <h3 className="mb-2 text-lg font-semibold">{t("errorTitle")}</h3>
                    <p className="text-sm">{body}</p>
                    <button
                        onClick={() => router.refresh()}
                        className="bg-error/10 hover:bg-error/20 text-error mt-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                        {t("errorRetry")}
                    </button>
                </div>
            </div>
        </section>
    );
}
