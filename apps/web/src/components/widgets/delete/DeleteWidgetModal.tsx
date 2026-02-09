"use client";

import { ReactElement, useState } from "react";
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
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    return (
        <Modal
            title={t("title")}
            subtitle={t("subtitle", { name: widgetTitle })}
            onClose={() => (busy ? null : onClose())}
        >
            <div className="space-y-4">
                <p className="text-muted text-sm">{t("confirmText")}</p>

                {err ? (
                    <div className="border-error-muted bg-error-subtle text-error rounded-md border px-3 py-2 text-sm">
                        {err}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        {t("cancel")}
                    </Button>
                    <Button
                        onClick={async () => {
                            setBusy(true);
                            setErr(null);
                            const res = await deleteWidget(widgetId);
                            setBusy(false);
                            if (!res.ok) {
                                setErr(res.error ?? t("genericError"));
                                return;
                            }
                            onClose();
                            onDeleted();
                        }}
                        disabled={busy}
                    >
                        {busy ? t("deleting") : t("delete")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
