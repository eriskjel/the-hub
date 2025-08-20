import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import { WIDGET_KINDS, type WidgetKind } from "@/widgets/schema";
import { ServerPingsSettings } from "@/widgets/server-pings/ServerPingSettings";
import { GroceryDealsSettings } from "@/widgets/grocery-deals/GroceryDealsSettings";

/** Shared create form values (stable shape) */
export type CreateWidgetFormValues = {
    title: string;
    kind: WidgetKind;
    settings: {
        // server-pings
        target?: string;
        // pi-health
        deviceId?: string;
        // grocery-deals
        query?: string;
        maxResults?: number;
        city?: string;
        lat?: number;
        lon?: number;
    };
};

/** Per-kind settings schemas (used for UI + defaults; validation enforced in modal schema) */
export const serverPingsSettingsSchema = z.object({
    target: z.preprocess(
        (v) => (typeof v === "string" ? normalizeUrlLike(v) : v),
        z
            .string()
            .url("Must be a valid URL starting with http(s)://")
            .refine((u) => /^https?:\/\//i.test(u), "Only http:// or https:// are supported")
    ),
});

export type CreateRegistryEntry = {
    schema: z.ZodTypeAny;
    defaults: Partial<CreateWidgetFormValues["settings"]>;
    SettingsForm: (props: {
        form: UseFormReturn<CreateWidgetFormValues, unknown, CreateWidgetFormValues>;
    }) => ReactElement;
};

function normalizeUrlLike(input: string): string {
    let s = input.trim();
    if (!s) return s;

    // If no scheme but looks like a domain, prefix https://
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
        // very light domain-ish check: has a dot, no spaces
        if (/\s/.test(s) || !s.includes(".")) return s; // let .url() fail later
        s = `https://${s}`;
    }

    // Fix common typos quickly (optional)
    if (s.startsWith("htp://")) s = s.replace(/^htp:\/\//, "http://");

    // Disallow non-http(s)
    if (!/^https?:\/\//i.test(s)) return s;

    // Drop trailing slash (cosmetic)
    if (s.endsWith("/")) s = s.slice(0, -1);

    return s;
}

export const creationRegistry: Partial<Record<WidgetKind, CreateRegistryEntry>> = {
    "server-pings": {
        schema: serverPingsSettingsSchema,
        defaults: { target: "" },
        SettingsForm: ServerPingsSettings,
    },
    "grocery-deals": {
        schema: z.object({
            query: z.string().min(1, "Please enter a search term"),
            maxResults: z.number().int().min(1).max(100).optional(),
            city: z.string().optional(),
            lat: z.number().optional(),
            lon: z.number().optional(),
        }),
        defaults: { query: "monster", maxResults: 12 },
        SettingsForm: GroceryDealsSettings,
    },
};

/** Enabled kinds (intersection of schema kinds and creation registry) */
export const ENABLED_KINDS = WIDGET_KINDS.filter(
    (kind) => creationRegistry[kind] !== undefined
) as WidgetKind[];
