import type { UseFormReturn } from "react-hook-form";
import type { CreateWidgetFormValues } from "@/widgets/create/registry";
import { ReactElement } from "react";
import { useTranslations } from "next-intl";

export function ServerPingsSettings({
    form,
}: {
    form: UseFormReturn<CreateWidgetFormValues, unknown, CreateWidgetFormValues>;
}): ReactElement {
    const t = useTranslations("widgets.create");

    return (
        <div className="rounded-xl border border-neutral-200 p-3 text-left">
            <div className="mb-2 text-sm text-neutral-700">
                <strong>{t("serverPings.title")}</strong> — {t("serverPings.help")}
            </div>
            <label className="mb-1 block text-sm font-medium">{t("serverPings.targetLabel")}</label>
            <input
                {...form.register("settings.target")}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder={t("serverPings.targetPlaceholder")}
            />
            <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.settings?.target?.message}
            </p>
        </div>
    );
}
