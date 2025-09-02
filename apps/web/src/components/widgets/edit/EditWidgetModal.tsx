"use client";

import { ReactElement, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button, FieldText } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import type { AnyWidget } from "@/widgets/schema";
import { useCreateWidgetForm } from "@/widgets/create/useCreateWidgetForm";
import { isEditableKind } from "@/widgets/create/registry";
import { updateWidget } from "@/lib/widgets/updateWidget";
import {purgeWidgetLocalCache} from "@/lib/widgets/purgeCaches";

export default function EditWidgetModal({
    widget,
    onClose,
    userId
}: {
    widget: AnyWidget;
    onClose: () => void;
    userId?: string | null;
}): ReactElement {
    const t = useTranslations("widgets.edit");
    const router = useRouter();

    if (!isEditableKind(widget.kind)) {
        // If opened somehow (deep link etc.), show a friendly message
        return (
            <Modal title={t("title", { default: "Edit widget" })} onClose={onClose}>
                <div className="space-y-4">
                    <p className="text-sm text-neutral-700">
                        {t("unsupported", {
                            default: "Editing isn’t available for this widget type yet.",
                        })}
                    </p>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={onClose}>
                            {t("close", { default: "Close" })}
                        </Button>
                    </div>
                </div>
            </Modal>
        );
    }

    const { form, active } = useCreateWidgetForm(widget.kind, t);
    const Settings = active.SettingsForm;

    useEffect(() => {
        // Seed in the same shape your SettingsForm expects (usually nested under `settings`)
        form.reset({
            title: widget.title ?? "",
            kind: widget.kind,
            settings: widget.settings ?? {},
        } as any);
    }, [form, widget]);

    return (
        <Modal
            title={t("title", { default: "Edit widget" })}
            subtitle={t("subtitle", { default: "Update the name or settings and save." })}
            onClose={onClose}
        >
            <form
                className="space-y-4 text-left"
                onSubmit={form.handleSubmit(async (values) => {
                    const res = await updateWidget(widget.instanceId, values);
                    if (res.ok) {
                        onClose();
                        purgeWidgetLocalCache(userId, widget.kind, widget.instanceId);
                        router.refresh();
                    } else {
                        form.setError("root", { type: "server", message: res.error });
                    }
                })}
            >
                <FieldText
                    label={t("name", { default: "Name" })}
                    placeholder={t("namePlaceholder", { default: "My widget" })}
                    error={form.formState.errors.title?.message}
                    {...form.register("title")}
                />

                <input type="hidden" {...form.register("kind")} value={widget.kind} />

                {/* @ts-expect-error form is specialized per kind */}
                <Settings form={form} isEdit />

                {form.formState.errors.root?.message ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {form.formState.errors.root.message}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>
                        {t("cancel", { default: "Cancel" })}
                    </Button>
                    <Button type="submit">
                        {form.formState.isSubmitting
                            ? t("saving", { default: "Saving…" })
                            : t("save", { default: "Save" })}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
