"use client";

import { useLayoutEffect, useMemo } from "react";
import { z } from "zod";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    buildGrocerySettingsSchema,
    type CreationKind,
    creationRegistry,
} from "@/widgets/create/registry";

export type BaseForm = { kind: CreationKind; settings: unknown };

export function useCreateWidgetForm(
    kind: CreationKind,
    t: (k: string) => string,
    mode: "create" | "edit"
) {
    const active = creationRegistry[kind];

    const settingsSchema = useMemo(() => {
        return active.kind === "grocery-deals"
            ? buildGrocerySettingsSchema(t, mode)
            : active.schema;
    }, [active.kind, active.schema, t, mode]);

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

    // useLayoutEffect so this reset runs before any child useEffect (e.g. the
    // location bootstrap in useLocationControls) on the same commit. Without
    // this, the child bootstrap sets localStorage values and the reset wipes
    // them, breaking the "last used location" suggestion after a kind switch.
    useLayoutEffect(() => {
        // Skip if the form already holds this kind — avoids wiping form state on
        // initial mount (including values pre-filled from localStorage).
        if (form.getValues("kind") === kind) return;
        const next = creationRegistry[kind];
        form.reset({
            kind: next.kind,
            settings: next.defaults,
        });
    }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

    return { form, active };
}
