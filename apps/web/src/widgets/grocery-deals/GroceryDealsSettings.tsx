"use client";

import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FieldText } from "@/components/ui/Fields";
import { grocerySettingsSchema } from "@/widgets/create/registry";
import { z } from "zod";
import { useTranslations } from "next-intl";

type GroceryForm = UseFormReturn<{
    title: string;
    kind: "grocery-deals";
    settings: z.infer<typeof grocerySettingsSchema>;
}>;

type GroceryErrors = {
    settings?: {
        query?: { message?: string };
        maxResults?: { message?: string };
        city?: { message?: string };
        lat?: { message?: string };
        lon?: { message?: string };
    };
};

export function GroceryDealsSettings({ form }: { form: GroceryForm }): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals");

    const errs: GroceryErrors = form.formState.errors as GroceryErrors;

    return (
        <div className="space-y-3">
            <FieldText
                label={t("queryLabel")}
                placeholder={t("queryPlaceholder")}
                error={errs.settings?.query?.message}
                {...form.register("settings.query")}
            />
            <FieldText
                label={t("maxResultsLabel")}
                placeholder="12"
                type="number"
                error={errs.settings?.maxResults?.message}
                {...form.register("settings.maxResults", { valueAsNumber: true })}
            />
            <div className="grid grid-cols-2 gap-3">
                <FieldText
                    label={t("latLabel")}
                    placeholder="63.4306"
                    type="number"
                    step="any"
                    error={errs.settings?.lat?.message}
                    {...form.register("settings.lat", { valueAsNumber: true })}
                />
                <FieldText
                    label={t("lonLabel")}
                    placeholder="10.4037"
                    type="number"
                    step="any"
                    error={errs.settings?.lon?.message}
                    {...form.register("settings.lon", { valueAsNumber: true })}
                />
            </div>
            <FieldText
                label={t("cityLabel")}
                placeholder="Trondheim"
                error={errs.settings?.city?.message}
                {...form.register("settings.city")}
            />
        </div>
    );
}
