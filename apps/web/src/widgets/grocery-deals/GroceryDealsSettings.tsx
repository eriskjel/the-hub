"use client";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CreateWidgetFormValues } from "@/widgets/create/registry";
import { FieldText } from "@/components/ui/Fields";

export function GroceryDealsSettings({
    form,
}: {
    form: UseFormReturn<CreateWidgetFormValues, unknown, CreateWidgetFormValues>;
}): ReactElement {
    return (
        <div className="space-y-3">
            <FieldText
                label="Search term"
                placeholder="e.g. monster"
                error={form.formState.errors.settings?.query as unknown as string}
                {...form.register("settings.query")}
            />
            <FieldText
                label="Max results (optional)"
                placeholder="12"
                type="number"
                {...form.register("settings.maxResults", { valueAsNumber: true })}
            />
            <div className="grid grid-cols-2 gap-3">
                <FieldText
                    label="Latitude (optional)"
                    placeholder="63.4306"
                    type="number"
                    step="any"
                    {...form.register("settings.lat", { valueAsNumber: true })}
                />
                <FieldText
                    label="Longitude (optional)"
                    placeholder="10.4037"
                    type="number"
                    step="any"
                    {...form.register("settings.lon", { valueAsNumber: true })}
                />
            </div>
            <FieldText
                label="City label (optional)"
                placeholder="Trondheim"
                {...form.register("settings.city")}
            />
        </div>
    );
}
