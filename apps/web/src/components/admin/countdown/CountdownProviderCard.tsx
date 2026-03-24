"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CheckCircle, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchJson } from "@/lib/widgets/fetchJson";
import { API } from "@/lib/apiRoutes";
import type { CountdownProviderStatus } from "@/lib/admin/countdown.server";

export default function CountdownProviderCard({
    providerId,
    initialStatus,
}: {
    providerId: string;
    initialStatus: CountdownProviderStatus | null;
}) {
    const t = useTranslations("admin.widgets.countdown");
    const locale = useLocale();
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);

    const nextDate = status?.nextIso
        ? new Date(status.nextIso).toLocaleString(locale, {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Europe/Oslo",
          })
        : null;

    async function toggle() {
        if (!status) return;
        setLoading(true);
        try {
            await fetchJson<void>(API.admin.countdown.confirm(providerId), {
                method: status.adminConfirmed ? "DELETE" : "POST",
            });
            const fresh = await fetchJson<CountdownProviderStatus>(
                API.admin.countdown.status(providerId)
            );
            setStatus(fresh);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-surface rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">{t(`providers.${providerId}`)}</span>
                {status?.adminConfirmed ? (
                    <span className="text-success inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px]">
                        <CheckCircle className="h-3 w-3" />
                        {t("confirmed")}
                    </span>
                ) : status?.tentative ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                        ~ {t("unconfirmed")}
                    </span>
                ) : null}
            </div>

            <p className="text-muted mb-4 text-sm">
                {nextDate ? (
                    <>
                        {t("next")}: <span className="text-foreground font-medium">{nextDate}</span>
                    </>
                ) : (
                    t("noDate")
                )}
            </p>

            {status && (
                <Button
                    variant={status.adminConfirmed ? "secondary" : "success"}
                    disabled={loading}
                    onClick={toggle}
                >
                    {status.adminConfirmed ? (
                        <>
                            <CircleDashed className="h-3.5 w-3.5" />
                            {t("unconfirm")}
                        </>
                    ) : (
                        <>
                            <CheckCircle className="h-3.5 w-3.5" />
                            {t("confirm")}
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
