"use client";

import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FieldText } from "@/components/ui/Fields";
import { grocerySettingsSchema } from "@/widgets/create/registry"; // only the schema is imported
import { z } from "zod";

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
    const errs: GroceryErrors = form.formState.errors as GroceryErrors;

    return (
        <div className="space-y-3">
            <FieldText
                label="Search term"
                placeholder="e.g. monster"
                error={errs.settings?.query?.message}
                {...form.register("settings.query")}
            />
            <FieldText
                label="Max results (optional)"
                placeholder="12"
                type="number"
                error={errs.settings?.maxResults?.message}
                {...form.register("settings.maxResults", { valueAsNumber: true })}
            />
            <div className="grid grid-cols-2 gap-3">
                <FieldText
                    label="Latitude (optional)"
                    placeholder="63.4306"
                    type="number"
                    step="any"
                    error={errs.settings?.lat?.message}
                    {...form.register("settings.lat", { valueAsNumber: true })}
                />
                <FieldText
                    label="Longitude (optional)"
                    placeholder="10.4037"
                    type="number"
                    step="any"
                    error={errs.settings?.lon?.message}
                    {...form.register("settings.lon", { valueAsNumber: true })}
                />
            </div>
            <FieldText
                label="City label (optional)"
                placeholder="Trondheim"
                error={errs.settings?.city?.message}
                {...form.register("settings.city")}
            />
        </div>
    );
}
