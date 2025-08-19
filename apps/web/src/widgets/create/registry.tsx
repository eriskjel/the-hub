import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import { WIDGET_KINDS, type WidgetKind } from "@/widgets/schema";
import { ServerPingsSettings } from "@/widgets/server-pings/ServerPingSettings";

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
};

/** Enabled kinds (intersection of schema kinds and creation registry) */
export const ENABLED_KINDS = WIDGET_KINDS.filter(
    (kind) => creationRegistry[kind] !== undefined
) as WidgetKind[];
