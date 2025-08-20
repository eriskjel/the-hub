"use client";

import { ReactElement, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button, FieldSelect, FieldText } from "@/components/ui/Fields";
import { API } from "@/lib/apiRoutes";
import { useTranslations } from "next-intl";
import { creationRegistry, ENABLED_KINDS, type CreationKind } from "@/widgets/create/registry";
import type { Resolver } from "react-hook-form";

export default function CreateWidgetModal({ onClose }: { onClose: () => void }): ReactElement {
    const t = useTranslations("widgets.create");
    const router = useRouter();

    // State uses CreationKind (only the kinds in the create registry)
    const [kind, setKind] = useState<CreationKind>(ENABLED_KINDS[0]);

    const active = creationRegistry[kind];

    type BaseForm = { title: string; kind: CreationKind; settings: unknown };

    const schema = useMemo(
        () =>
            z.object({
                title: z.string().min(1, t("errors.titleRequired")),
                kind: z.literal(active.kind),
                settings: active.schema,
            }),
        [active.kind, active.schema, t]
    );

    const resolver = zodResolver(schema) as unknown as Resolver<BaseForm>;

    const form = useForm<BaseForm>({
        resolver,
        defaultValues: {
            title: "",
            kind: active.kind,
            settings: active.defaults,
        },
    });

    useEffect(() => {
        const next = creationRegistry[kind];
        form.reset({
            title: form.getValues("title"),
            kind: next.kind,
            settings: next.defaults,
        });
    }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = async (v: BaseForm) => {
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
                throw new Error(j.error || t("errors.failed"));
            }
            onClose();
            router.refresh();
        } catch (e: unknown) {
            // surface error message nicely
            const msg = e instanceof Error ? e.message : String(e);
            form.setError("root", { type: "server", message: msg });
        }
    };

    const Settings = active.SettingsForm;

    return (
        <Modal title={t("title")} subtitle={t("subtitle")} onClose={onClose}>
            <form className="space-y-4 text-left" onSubmit={form.handleSubmit(onSubmit)}>
                <FieldText
                    label={t("name")}
                    placeholder={t("namePlaceholder")}
                    error={form.formState.errors.title?.message}
                    {...form.register("title")}
                />

                {/* Kind dropdown + hidden bind */}
                <input type="hidden" {...form.register("kind")} value={kind} />
                <FieldSelect
                    label={t("kind")}
                    value={kind}
                    onChange={(v) => setKind(v as CreationKind)}
                    options={ENABLED_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
                    help={t("kindHelp")}
                />

                {/* Per-kind settings */}
                {/* Single, localized cast to satisfy the SettingsForm's local type */}
                {/* @ts-expect-error: narrowing BaseForm to the specific SettingsForm shape */}
                <Settings form={form} />

                {form.formState.errors.root?.message ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {form.formState.errors.root.message}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>
                        {t("cancel")}
                    </Button>
                    <Button type="submit">
                        {form.formState.isSubmitting ? t("submitting") : t("submit")}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
