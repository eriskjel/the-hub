"use client";
import type { ReactElement } from "react";
import { FieldSelect } from "@/components/ui/Fields";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { countdownSettingsSchema } from "@/widgets/create/registry";
import { useTranslations } from "next-intl";

type FormType = UseFormReturn<{
    kind: "countdown";
    settings: z.infer<typeof countdownSettingsSchema>;
}>;

type Provider = z.infer<typeof countdownSettingsSchema>["provider"];

export function Settings({ form }: { form: FormType }): ReactElement {
    const t = useTranslations("widgets.countdown.create");
    const providerErr = form.getFieldState("settings.provider").error?.message;

    return (
        <div className="space-y-4">
            <FieldSelect
                label={t("provider.label")}
                value={String(form.watch("settings.provider") ?? "")}
                onChange={(v) => {
                    form.setValue("settings.provider", v as Provider, { shouldValidate: true });
                }}
                options={[
                    { value: "trippel-trumf", label: t("provider.options.trippelTrumf") },
                    { value: "dnb-supertilbud", label: t("provider.options.dnbSupertilbud") },
                    {
                        value: "custom-date",
                        label: t("provider.options.customDate"),
                        disabled: true,
                    },
                ]}
                error={providerErr}
            />

            {/* showHours toggle – hidden until wired up end-to-end */}
        </div>
    );
}

export { Settings as CountdownSettingsForm };
