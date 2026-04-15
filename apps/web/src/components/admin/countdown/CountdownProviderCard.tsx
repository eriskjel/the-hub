"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CheckCircle, CircleDashed, Ban, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchJson } from "@/lib/widgets/fetchJson";
import { API } from "@/lib/apiRoutes";
import type { CountdownDeniedEntry, CountdownProviderStatus } from "@/lib/admin/countdown.server";

const OSLO_TZ = "Europe/Oslo";

function osloDate(iso: string): string {
    // en-CA gives YYYY-MM-DD which is what the backend expects.
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: OSLO_TZ });
}

export default function CountdownProviderCard({
    providerId,
    initialStatus,
    initialDenied,
}: {
    providerId: string;
    initialStatus: CountdownProviderStatus | null;
    initialDenied: CountdownDeniedEntry[];
}) {
    const t = useTranslations("admin.widgets.countdown");
    const locale = useLocale();
    const [status, setStatus] = useState(initialStatus);
    const [denied, setDenied] = useState(initialDenied);
    const [loading, setLoading] = useState(false);

    const nextDate = status?.nextIso
        ? new Date(status.nextIso).toLocaleString(locale, {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: OSLO_TZ,
          })
        : null;

    async function refresh() {
        const [fresh, freshDenied] = await Promise.all([
            fetchJson<CountdownProviderStatus>(API.admin.countdown.status(providerId)),
            fetchJson<CountdownDeniedEntry[]>(API.admin.countdown.denied(providerId)),
        ]);
        setStatus(fresh);
        setDenied(freshDenied);
    }

    async function toggleConfirm() {
        if (!status) return;
        setLoading(true);
        try {
            await fetchJson<void>(API.admin.countdown.confirm(providerId), {
                method: status.adminConfirmed ? "DELETE" : "POST",
            });
            await refresh();
        } finally {
            setLoading(false);
        }
    }

    async function deny() {
        if (!status?.nextIso) return;
        if (!confirm(t("denyConfirm"))) return;
        const date = osloDate(status.nextIso);
        setLoading(true);
        try {
            await fetchJson<void>(API.admin.countdown.denied(providerId, date), {
                method: "POST",
            });
            await refresh();
        } catch {
            alert(t("denyFailed"));
        } finally {
            setLoading(false);
        }
    }

    async function undeny(date: string) {
        setLoading(true);
        try {
            await fetchJson<void>(API.admin.countdown.denied(providerId, date), {
                method: "DELETE",
            });
            await refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-surface w-72 shrink-0 rounded-xl border p-4">
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
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={status.adminConfirmed ? "secondary" : "success"}
                        disabled={loading}
                        onClick={toggleConfirm}
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
                    {status.nextIso && (
                        <Button variant="destructive" disabled={loading} onClick={deny}>
                            <Ban className="h-3.5 w-3.5" />
                            {t("deny")}
                        </Button>
                    )}
                </div>
            )}

            {denied.length > 0 && (
                <div className="border-border mt-4 border-t pt-3">
                    <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                        {t("deniedDates")}
                    </p>
                    <ul className="space-y-1 text-sm">
                        {denied.map((d) => (
                            <li
                                key={d.deniedDate}
                                className="flex items-center justify-between gap-2"
                            >
                                <span className="text-foreground font-mono">{d.deniedDate}</span>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => undeny(d.deniedDate)}
                                    className="text-muted hover:text-foreground inline-flex items-center gap-1 text-xs"
                                    aria-label={t("undeny")}
                                >
                                    <Undo2 className="h-3 w-3" />
                                    {t("undeny")}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
