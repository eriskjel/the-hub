import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import type { WidgetKind } from "@/widgets/schema";
import { ServerPingsSettings } from "@/widgets/server-pings/ServerPingSettings";
import { GroceryDealsSettings } from "@/widgets/grocery-deals/GroceryDealsSettings";
import { CountdownSettingsForm } from "@/widgets/countdown/settings";
import CinemateketSettings from "@/widgets/cinemateket/CinemateketSettings";

// Per-kind settings schemas
export const serverPingsSettingsSchema = z.object({
    target: z.string().url("Must be a valid URL"),
});

const grocerySettingsBase = z.object({
    query: z.string().trim().min(1, "Please enter a search term").optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
});

export const groceryCreateSettingsSchema = grocerySettingsBase;

export const groceryEditSettingsSchema = grocerySettingsBase.extend({
    maxResults: z.coerce.number().int().min(1).max(20).default(10),
});

export const groceryUnionSettingsSchema = z.union([
    groceryCreateSettingsSchema,
    groceryEditSettingsSchema,
]);

export const buildGrocerySettingsSchema = (t: (key: string) => string, mode: "create" | "edit") =>
    (mode === "edit" ? groceryEditSettingsSchema : groceryCreateSettingsSchema).superRefine(
        (val, ctx) => {
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
        }
    );

const countdownFixed = z.object({
    source: z.literal("fixed-date"),
    targetIso: z.string().min(1, "Choose a date/time"),
});

const countdownMonthlyRule = z.object({
    source: z.literal("monthly-rule"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
    byWeekday: z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]).optional(),
    bySetPos: z.number().int().min(-5).max(5).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
});

const countdownProvider = z.object({
    source: z.literal("provider"),
    provider: z.enum(["trippel-trumf", "dnb-supertilbud"]),
});

export const countdownSettingsSchemaBase = z.object({
    showHours: z.boolean().default(true),
});

export const countdownSettingsSchema = countdownSettingsSchemaBase
    .and(z.discriminatedUnion("source", [countdownFixed, countdownMonthlyRule, countdownProvider]))
    .superRefine((val, ctx) => {
        if (val.source === "monthly-rule") {
            const byPair = !!val.byWeekday && typeof val.bySetPos === "number";
            const byDay = typeof val.dayOfMonth === "number";
            if (!(byPair || byDay)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["dayOfMonth"],
                    message: "Pick either dayOfMonth OR (weekday + set position)",
                });
            }
            if (byPair && byDay) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["dayOfMonth"],
                    message: "Use dayOfMonth OR weekday+setpos, not both",
                });
            }
        }
    });

export const cinemateketSettingsSchema = z.object({});

// Generic entry type
export type CreateEntry<K extends WidgetKind, S extends z.ZodTypeAny> = {
    kind: K;
    schema: S;
    defaults: z.infer<S>;
    SettingsForm: (props: {
        form: UseFormReturn<{ kind: K; settings: z.infer<S> }>;
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
        schema: groceryUnionSettingsSchema,
        defaults: groceryCreateSettingsSchema.parse({}),
        SettingsForm: GroceryDealsSettings,
    }),
    "server-pings": createEntry({
        kind: "server-pings",
        schema: serverPingsSettingsSchema,
        defaults: { target: "" },
        SettingsForm: ServerPingsSettings,
    }),
    countdown: createEntry({
        kind: "countdown",
        schema: countdownSettingsSchema,
        defaults: defaultsFromSchema(countdownSettingsSchema, {
            showHours: true,
            source: "provider",
            provider: "trippel-trumf",
        }),
        SettingsForm: CountdownSettingsForm,
    }),
    cinemateket: createEntry({
        kind: "cinemateket",
        schema: cinemateketSettingsSchema,
        defaults: {},
        SettingsForm: CinemateketSettings,
    }),
} as const;

export type CreationRegistry = typeof creationRegistry;
export type CreationKind = keyof CreationRegistry;

export type EditableKind = CreationKind;

export function isEditableKind(kind: WidgetKind): kind is EditableKind {
    return kind in creationRegistry;
}

// Derive the dropdown list at runtime
export const ENABLED_KINDS = Object.keys(creationRegistry) as CreationKind[];
