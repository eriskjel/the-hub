"use client";

import { useEffect, useMemo } from "react";
import { z } from "zod";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    buildGrocerySettingsSchema,
    type CreationKind,
    creationRegistry,
} from "@/widgets/create/registry";

export type BaseForm = { kind: CreationKind; settings: unknown };

export function useCreateWidgetForm(kind: CreationKind, t: (k: string) => string) {
    const active = creationRegistry[kind];

    const settingsSchema = useMemo(() => {
        return active.kind === "grocery-deals" ? buildGrocerySettingsSchema(t) : active.schema;
    }, [active.kind, active.schema, t]);

    const schema = useMemo(
        () =>
            z.object({
                kind: z.literal(active.kind),
                settings: settingsSchema,
            }),
        [active.kind, settingsSchema]
    );

    // bridge resolver types without `any`
    const resolver = zodResolver(schema) as unknown as Resolver<BaseForm>;

    const form = useForm<BaseForm>({
        resolver,
        defaultValues: {
            kind: active.kind,
            settings: active.defaults,
        },
    });

    useEffect(() => {
        const next = creationRegistry[kind];
        form.reset({
            kind: next.kind,
            settings: next.defaults,
        });
    }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

    return { form, active };
}
