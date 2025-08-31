import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import type { WidgetKind } from "@/widgets/schema";
import { ServerPingsSettings } from "@/widgets/server-pings/ServerPingSettings";
import { GroceryDealsSettings } from "@/widgets/grocery-deals/GroceryDealsSettings";

// Per-kind settings schemas
export const serverPingsSettingsSchema = z.object({
    target: z.string().url("Must be a valid URL"),
});

export const grocerySettingsSchema = z.object({
    query: z.string().trim().min(1, "Please enter a search term").optional(),
    maxResults: z.coerce.number().int().min(1).max(20).default(10),
    city: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
});

export const buildGrocerySettingsSchema = (t: (key: string) => string) =>
    grocerySettingsSchema.superRefine((val, ctx) => {
        const hasCoords =
            typeof val.lat === "number" &&
            Number.isFinite(val.lat) &&
            typeof val.lon === "number" &&
            Number.isFinite(val.lon);
        const hasCity = !!val.city?.trim();

        if (!hasCoords && !hasCity) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["city"],
                message: t("groceryDeals.location.required"),
            });
        }
    });

// Generic entry type
export type CreateEntry<K extends WidgetKind, S extends z.ZodTypeAny> = {
    kind: K;
    schema: S;
    defaults: z.infer<S>;
    SettingsForm: (props: {
        form: UseFormReturn<{ title: string; kind: K; settings: z.infer<S> }>;
    }) => ReactElement;
};

export const createEntry = <K extends WidgetKind, S extends z.ZodTypeAny>(e: CreateEntry<K, S>) =>
    e;

function defaultsFromSchema<S extends z.ZodTypeAny>(
    schema: S,
    overrides?: Partial<z.infer<S>>
): z.infer<S> {
    return schema.parse(overrides ?? {});
}

// Registry (only list kinds you actually support in the create modal)
export const creationRegistry = {
    "grocery-deals": createEntry({
        kind: "grocery-deals",
        schema: grocerySettingsSchema,
        defaults: defaultsFromSchema(grocerySettingsSchema),
        SettingsForm: GroceryDealsSettings,
    }),
    "server-pings": createEntry({
        kind: "server-pings",
        schema: serverPingsSettingsSchema,
        defaults: { target: "" },
        SettingsForm: ServerPingsSettings,
    }),
} as const;

export type CreationRegistry = typeof creationRegistry;
export type CreationKind = keyof CreationRegistry;

// Derive the dropdown list at runtime
export const ENABLED_KINDS = Object.keys(creationRegistry) as CreationKind[];
