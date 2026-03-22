"use client";

import { ReactElement } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import { deleteWidget } from "@/lib/widgets/deleteWidget";

export function DeleteWidgetModal({
    open,
    onClose,
    widgetId,
    widgetTitle,
    onDeleted,
}: {
    open: boolean;
    onClose: () => void;
    widgetId: string;
    widgetTitle: string;
    onDeleted: () => void;
}): ReactElement | null {
    const t = useTranslations("widgets.delete");

    const { mutate, isPending, error } = useMutation({
        mutationFn: () => deleteWidget(widgetId),
        onSuccess: (res) => {
            if (!res.ok) throw new Error(res.error ?? t("genericError"));
            onClose();
            onDeleted();
        },
    });

    if (!open) return null;

    return (
        <Modal
            title={t("title")}
            subtitle={t("subtitle", { name: widgetTitle })}
            onClose={() => (isPending ? null : onClose())}
        >
            <div className="space-y-4">
                <p className="text-muted text-sm">{t("confirmText")}</p>

                {error ? (
                    <div className="border-error-muted bg-error-subtle text-error rounded-md border px-3 py-2 text-sm">
                        {error.message}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={() => mutate()} disabled={isPending}>
                        {isPending ? t("deleting") : t("delete")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
