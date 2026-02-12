"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import type { AnyWidget } from "@/widgets/schema";
import { type BaseForm, useCreateWidgetForm } from "@/widgets/create/useCreateWidgetForm";
import { type EditableKind, isEditableKind } from "@/widgets/create/registry";
import { updateWidget } from "@/lib/widgets/updateWidget";
import { purgeWidgetLocalCache } from "@/lib/widgets/purgeCaches";
import { useEditWidgetPrefill } from "./useEditWidgetPrefill";

type EditableWidget = Extract<AnyWidget, { kind: EditableKind }>;

export default function EditWidgetModal({
    widget,
    onClose,
    userId,
}: {
    widget: AnyWidget;
    onClose: () => void;
    userId?: string | null;
}) {
    const t = useTranslations("widgets.edit");

    if (!isEditableKind(widget.kind)) {
        return (
            <Modal title={t("title", { default: "Edit widget" })} onClose={onClose}>
                <div className="space-y-4">
                    <p className="text-muted text-sm">
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

    return (
        <EditWidgetModalContent
            widget={widget as EditableWidget}
            onClose={onClose}
            userId={userId}
        />
    );
}

function EditWidgetModalContent({
    widget,
    onClose,
    userId,
}: {
    widget: EditableWidget;
    onClose: () => void;
    userId?: string | null;
}) {
    const t = useTranslations("widgets.edit");
    const tCreate = useTranslations("widgets.create");
    const router = useRouter();

    const { form, active } = useCreateWidgetForm(widget.kind, tCreate, "edit");
    const Settings = active.SettingsForm;

    useEditWidgetPrefill(form, widget);

    return (
        <Modal
            title={t("title", { default: "Edit widget" })}
            subtitle={t("subtitle", { default: "Update the name or settings and save." })}
            onClose={onClose}
        >
            <form
                className="space-y-4 text-left"
                onSubmit={form.handleSubmit(async (values: BaseForm) => {
                    const res = await updateWidget(widget.instanceId, values);
                    if (res.ok) {
                        onClose();
                        purgeWidgetLocalCache(userId, widget.kind, widget.instanceId);
                        router.refresh();
                    } else {
                        const code = res.error ?? "";
                        const keyish = /^[a-z0-9._-]+$/i.test(code) ? code : "generic";
                        const errorKey = `errors.${keyish}` as const;
                        form.setError("root", {
                            type: "server",
                            message: tCreate.has(errorKey)
                                ? tCreate(errorKey)
                                : tCreate("errors.generic"),
                        });
                    }
                })}
            >
                {/* keep kind bound in the form state */}
                <input type="hidden" {...form.register("kind")} value={widget.kind} />

                {/* The Settings form is already typed per-kind in the registry */}
                {/* @ts-expect-error: generic narrowing across union kinds */}
                <Settings form={form} isEdit initialSettings={widget.settings} />

                {form.formState.errors.root?.message ? (
                    <div className="border-error-muted bg-error-subtle text-error rounded-md border px-3 py-2 text-sm">
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
