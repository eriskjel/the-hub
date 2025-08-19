"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button, FieldSelect, FieldText } from "@/components/ui/Fields";
import {
    creationRegistry,
    ENABLED_KINDS,
    type CreateWidgetFormValues,
} from "@/widgets/create/registry";
import type { WidgetKind } from "@/widgets/schema";
import { API } from "@/lib/apiRoutes";

/** A literal enum from ENABLED_KINDS so Zod can narrow string values */
const KindEnum = z.enum(
    ENABLED_KINDS.length ? (ENABLED_KINDS as [WidgetKind, ...WidgetKind[]]) : ["server-pings"]
);

/** Settings base shape keeps both potential keys optional */
const SettingsBase = z.object({
    target: z.string().url("Must be a valid URL").optional(),
    deviceId: z.string().uuid("Pick a device").optional(),
});

/** Stable schema → always matches CreateWidgetFormValues */
const FormSchema = z
    .object({
        title: z.string().min(1, "Please enter a name"),
        kind: KindEnum,
        settings: SettingsBase,
    })
    .superRefine((val, ctx) => {
        if (val.kind === "server-pings" && !val.settings.target) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["settings", "target"],
                message: "Target URL is required",
            });
        }
    });

export default function CreateWidgetModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [kind, setKind] = useState<WidgetKind>(ENABLED_KINDS[0] ?? "server-pings");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const active = creationRegistry[kind]!;

    const form = useForm<CreateWidgetFormValues, unknown, CreateWidgetFormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            title: "",
            kind,
            settings: active.defaults,
        },
    });

    // Reset when kind changes (preserve title)
    useEffect(() => {
        form.reset({
            title: form.getValues("title"),
            kind,
            settings: creationRegistry[kind]?.defaults ?? {},
        });
    }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit: SubmitHandler<CreateWidgetFormValues> = async (v) => {
        setSubmitError(null);
        setSubmitting(true);
        try {
            const res = await fetch(API.widgets.create, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: v.title,
                    kind: v.kind,
                    settings: v.settings,
                    grid: { x: 0, y: 0, w: 1, h: 1 },
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || "Failed to create widget");
            }
            onClose();
            router.refresh();
        } catch (e: unknown) {
            setSubmitError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    };

    const Settings = active.SettingsForm;

    return (
        <Modal title="Create a widget" subtitle="Enter widget details" onClose={onClose}>
            <form className="space-y-4 text-left" onSubmit={form.handleSubmit(onSubmit)}>
                <FieldText
                    label="Name"
                    placeholder="My widget"
                    error={form.formState.errors.title?.message}
                    {...form.register("title")}
                />

                {/* Kind dropdown + hidden field to bind to form */}
                <input type="hidden" {...form.register("kind")} value={kind} />
                <FieldSelect
                    label="Widget type"
                    value={kind}
                    onChange={(v) => setKind(v as WidgetKind)}
                    options={
                        ENABLED_KINDS.length
                            ? ENABLED_KINDS.map((k) => ({ value: k, label: k }))
                            : [{ value: "server-pings", label: "server-pings" }]
                    }
                    help="Choose what to create. More types coming soon."
                />

                {/* Kind-specific settings */}
                <Settings form={form} />

                {submitError ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {submitError}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating…" : "Create widget"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
