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
    query: z.string().min(1, "Please enter a search term"),
    maxResults: z.number().int().min(1).max(100).optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
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

// Registry (only list kinds you actually support in the create modal)
export const creationRegistry = {
    "server-pings": createEntry({
        kind: "server-pings",
        schema: serverPingsSettingsSchema,
        defaults: { target: "" },
        SettingsForm: ServerPingsSettings,
    }),
    "grocery-deals": createEntry({
        kind: "grocery-deals",
        schema: grocerySettingsSchema,
        defaults: { query: "monster", maxResults: 12 },
        SettingsForm: GroceryDealsSettings,
    }),
} as const;

export type CreationRegistry = typeof creationRegistry;
export type CreationKind = keyof CreationRegistry;

// Derive the dropdown list at runtime
export const ENABLED_KINDS = Object.keys(creationRegistry) as CreationKind[];
