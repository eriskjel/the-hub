"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { DeleteWidgetModal } from "./DeleteWidgetModal";

export function DeleteWidgetButton({
    widgetId,
    widgetTitle,
}: {
    widgetId: string;
    widgetTitle: string;
}): ReactElement {
    const t = useTranslations("widgets.delete");
    const router = useRouter();
    const [open, setOpen] = useState(false);

    return (
        <>
            <IconButton
                aria-label={t("ariaDelete")}
                title={t("ariaDelete")}
                onClick={() => setOpen(true)}
            >
                <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>

            <DeleteWidgetModal
                open={open}
                onClose={() => setOpen(false)}
                widgetId={widgetId}
                widgetTitle={widgetTitle}
                onDeleted={() => router.refresh()}
            />
        </>
    );
}
