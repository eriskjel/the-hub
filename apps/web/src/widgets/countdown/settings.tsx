"use client";
import { type ReactElement } from "react";
import { ErrorText, FieldRow, FieldSelect, FieldText, Label } from "@/components/ui/Fields";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { countdownSettingsSchema } from "@/widgets/create/registry";
import { useTranslations } from "next-intl";

type FormType = UseFormReturn<{
    title: string;
    kind: "countdown";
    settings: z.infer<typeof countdownSettingsSchema>;
}>;

type CountdownSettings = z.infer<typeof countdownSettingsSchema>;
type Source = CountdownSettings["source"];
type MonthlyByWeekday = Extract<CountdownSettings, { source: "monthly-rule" }>["byWeekday"];
type Provider = Extract<CountdownSettings, { source: "provider" }>["provider"];

export function Settings({ form }: { form: FormType }): ReactElement {
    const t = useTranslations("widgets.countdown.create");
    const source = (form.watch("settings.source") as Source | undefined) ?? "";

    // Error helpers – no union headaches
    const targetIsoErr = form.getFieldState("settings.targetIso").error?.message;
    const timeErr = form.getFieldState("settings.time").error?.message;

    const providerErr = form.getFieldState("settings.provider").error?.message;

    return (
        <div className="space-y-4">
            <FieldSelect
                label={t("sourceLabel")}
                value={String(source)}
                onChange={(v) =>
                    form.setValue("settings.source", v as Source, { shouldValidate: true })
                }
                options={[
                    { value: "provider", label: t("source.provider") },
                    //{ value: "fixed-date", label: t("source.fixed") },
                    //{ value: "monthly-rule", label: t("source.monthlyRule") },
                ]}
            />

            {source === "fixed-date" && (
                <FieldText
                    label={t("fixed.target")}
                    placeholder="2025-12-31T23:59:59+01:00"
                    {...form.register("settings.targetIso")}
                    error={targetIsoErr}
                />
            )}

            {source === "monthly-rule" && (
                <div className="grid grid-cols-2 gap-3">
                    <FieldText
                        label={t("rule.time")}
                        placeholder="08:00"
                        {...form.register("settings.time")}
                        error={timeErr}
                    />
                    <FieldText
                        label={t("rule.dayOfMonth")}
                        placeholder={t("rule.dayOfMonthPh")}
                        {...form.register("settings.dayOfMonth", { valueAsNumber: true })}
                    />
                    <FieldSelect
                        label={t("rule.byWeekday")}
                        value={String(form.watch("settings.byWeekday") ?? "")}
                        onChange={(v) =>
                            form.setValue(
                                "settings.byWeekday",
                                (v || undefined) as MonthlyByWeekday,
                                {
                                    shouldValidate: true,
                                }
                            )
                        }
                        options={[
                            { value: "", label: t("rule.none") },
                            ...["MO", "TU", "WE", "TH", "FR", "SA", "SU"].map((w) => ({
                                value: w,
                                label: w,
                            })),
                        ]}
                    />
                    <FieldText
                        label={t("rule.bySetPos")}
                        placeholder={t("rule.bySetPosPh")}
                        {...form.register("settings.bySetPos", { valueAsNumber: true })}
                    />
                    <div className="col-span-2 text-xs text-neutral-500">{t("rule.help")}</div>
                </div>
            )}

            {source === "provider" && (
                <FieldSelect
                    label={t("provider.label")}
                    value={String(form.watch("settings.provider") ?? "")}
                    onChange={(v) =>
                        form.setValue("settings.provider", v as Provider, { shouldValidate: true })
                    }
                    options={[
                        { value: "trippel-trumf", label: t("provider.options.trippelTrumf") },
                        { value: "dnb-supertilbud", label: t("provider.options.dnbSupertilbud") },
                    ]}
                    error={providerErr}
                />
            )}

            <FieldRow>
                <Label>{t("showHours")}</Label>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={Boolean(form.watch("settings.showHours") ?? true)}
                        onChange={(e) => form.setValue("settings.showHours", e.target.checked)}
                    />
                </div>
                <ErrorText>{undefined}</ErrorText>
            </FieldRow>
        </div>
    );
}

export { Settings as CountdownSettingsForm };
