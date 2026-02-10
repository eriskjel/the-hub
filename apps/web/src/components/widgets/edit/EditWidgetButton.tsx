"use client";

import { useState, type ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import EditWidgetModal from "@/components/widgets/edit/EditWidgetModal";
import { IconButton } from "@/components/ui/IconButton";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isEditableKind } from "@/widgets/create/registry";

type EditWidgetButtonProps = {
    widget: AnyWidget;
    forceDisabledTooltip?: string;
    userId?: string;
    backendUnreachable?: boolean;
};

export function EditWidgetButton({
    widget,
    forceDisabledTooltip,
    userId,
    backendUnreachable = false,
}: EditWidgetButtonProps): ReactElement {
    const t = useTranslations("widgets.edit");
    const tStates = useTranslations("dashboard.states");
    const [open, setOpen] = useState(false);

    const editable = isEditableKind(widget.kind);
    const aria = t("ariaEdit", { default: "Edit widget" });

    const handleClick = () => {
        if (backendUnreachable) {
            toast.error(tStates("backendUnreachableAction"));
            return;
        }
        if (editable) setOpen(true);
    };

    return (
        <>
            <IconButton
                aria-label={aria}
                title={
                    editable
                        ? aria
                        : (forceDisabledTooltip ??
                          t("notEditable", { default: "Not editable yet" }))
                }
                onClick={handleClick}
                disabled={!editable}
                className={editable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}
            >
                <Pencil className="h-4 w-4" aria-hidden />
            </IconButton>

            {open ? (
                <EditWidgetModal widget={widget} userId={userId} onClose={() => setOpen(false)} />
            ) : null}
        </>
    );
}
