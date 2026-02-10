"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DeleteWidgetModal } from "./DeleteWidgetModal";
import { purgeWidgetLocalCache } from "@/lib/widgets/purgeCaches";
import { WidgetKind } from "@/widgets/schema";

export function DeleteWidgetButton({
    widgetId,
    widgetTitle,
    userId,
    kind,
    backendUnreachable = false,
}: {
    widgetId: string;
    widgetTitle: string;
    userId?: string | null;
    kind: WidgetKind;
    backendUnreachable?: boolean;
}): ReactElement {
    const t = useTranslations("widgets.delete");
    const tStates = useTranslations("dashboard.states");
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleClick = () => {
        if (backendUnreachable) {
            toast.error(tStates("backendUnreachableAction"));
            return;
        }
        setOpen(true);
    };

    return (
        <>
            <IconButton
                aria-label={t("ariaDelete")}
                title={t("ariaDelete")}
                onClick={handleClick}
                className="cursor-pointer"
            >
                <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>

            <DeleteWidgetModal
                open={open}
                onClose={() => setOpen(false)}
                widgetId={widgetId}
                widgetTitle={widgetTitle}
                onDeleted={() => {
                    purgeWidgetLocalCache(userId, kind, widgetId);
                    router.refresh();
                }}
            />
        </>
    );
}
