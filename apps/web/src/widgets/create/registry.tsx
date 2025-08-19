// apps/web/src/widgets/create/registry.ts
import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import { WIDGET_KINDS, type WidgetKind } from "@/widgets/schema";

/** Shared create form values (stable shape) */
export type CreateWidgetFormValues = {
    title: string;
    kind: WidgetKind;
    settings: {
        target?: string; // server-pings
        deviceId?: string; // pi-health (later)
    };
};

/** Per-kind settings schemas (used for UI + defaults; validation enforced in modal schema) */
export const serverPingsSettingsSchema = z.object({
    target: z.string().url("Must be a valid URL"),
});

export type CreateRegistryEntry = {
    schema: z.ZodTypeAny;
    defaults: Partial<CreateWidgetFormValues["settings"]>;
    SettingsForm: (props: {
        form: UseFormReturn<CreateWidgetFormValues, unknown, CreateWidgetFormValues>;
    }) => ReactElement;
};

export const creationRegistry: Partial<Record<WidgetKind, CreateRegistryEntry>> = {
    "server-pings": {
        schema: serverPingsSettingsSchema,
        defaults: { target: "" },
        SettingsForm: ({ form }) => (
            <div className="rounded-xl border border-neutral-200 p-3">
                <div className="mb-2 text-sm text-neutral-700">
                    <strong>Server pings</strong> — set a URL to ping.
                </div>
                <label className="mb-1 block text-sm font-medium">Target URL</label>
                <input
                    {...form.register("settings.target")}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="https://example.com/health"
                />
                <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.settings?.target?.message}
                </p>
            </div>
        ),
    },
};

/** Enabled kinds (intersection of schema kinds and creation registry) */
export const ENABLED_KINDS = WIDGET_KINDS.filter(
    (kind) => creationRegistry[kind] !== undefined
) as WidgetKind[];
