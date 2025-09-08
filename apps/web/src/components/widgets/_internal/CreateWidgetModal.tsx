"use client";

import { ReactElement, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button, FieldText } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import { creationRegistry, type CreationKind } from "@/widgets/create/registry";
import { useCreateWidgetForm } from "@/widgets/create/useCreateWidgetForm";
import { onSubmitCreateWidget } from "@/widgets/create/onSubmitCreateWidget";
import { KindSelect } from "@/widgets/create/KindSelect";

export default function CreateWidgetModal({ onClose }: { onClose: () => void }): ReactElement {
    const t = useTranslations("widgets.create");
    const router = useRouter();
    const [kind, setKind] = useState<CreationKind>(
        Object.keys(creationRegistry)[0] as CreationKind
    );

    const { form, active } = useCreateWidgetForm(kind, t);
    const Settings = active.SettingsForm;

    const setFieldErr = (
        name: "settings.provider" | "settings.targetIso" | "settings.query",
        code: string
    ) =>
        form.setError(name as any, {
            type: "server",
            message: t(`errors.${code}`),
        });

    return (
        <Modal title={t("title")} subtitle={t("subtitle")} onClose={onClose}>
            <form
                className="space-y-4 text-left"
                onSubmit={form.handleSubmit((v) =>
                    onSubmitCreateWidget(v, {
                        onSuccess: () => {
                            onClose();
                            router.refresh();
                        },
                        onError: (code) => {
                            if (code === "duplicate_provider" || code === "provider_required") {
                                setFieldErr("settings.provider", code);
                                return;
                            }
                            if (code === "target_required") {
                                setFieldErr("settings.targetIso", code);
                                return;
                            }
                            if (code === "query_required") {
                                setFieldErr("settings.query", code);
                                return;
                            }
                            // fallback
                            form.setError("root", {
                                type: "server",
                                message: t(`errors.${code}`, { fallback: t("errors.generic") }),
                            });
                        },
                    })
                )}
            >
                <FieldText
                    label={t("name")}
                    placeholder={t("namePlaceholder")}
                    error={form.formState.errors.title?.message}
                    {...form.register("title")}
                />

                {/* hidden field to bind RHF value to state */}
                <input type="hidden" {...form.register("kind")} value={kind} />
                <KindSelect value={kind} onChange={setKind} t={t} />

                {/* Per-kind settings */}
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
