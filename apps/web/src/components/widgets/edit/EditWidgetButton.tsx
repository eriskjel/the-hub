"use client";

import { useState, type ReactElement } from "react";
import type { AnyWidget } from "@/widgets/schema";
import EditWidgetModal from "@/components/widgets/edit/EditWidgetModal";
import { IconButton } from "@/components/ui/IconButton";
import { Pencil, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { isEditableKind } from "@/widgets/create/registry"; // helper we added earlier

type Props = { widget: AnyWidget; compact?: boolean; forceDisabledTooltip?: string };

export function EditWidgetButton({ widget, compact, forceDisabledTooltip }: Props): ReactElement {
    const t = useTranslations("widgets.edit");
    const [open, setOpen] = useState(false);

    const editable = isEditableKind(widget.kind);
    const aria = t("ariaEdit", { default: "Edit widget" });

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
                onClick={() => editable && setOpen(true)}
                disabled={!editable}
                className={editable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}
            >
                <Pencil className="h-4 w-4" aria-hidden />
            </IconButton>

            {open ? <EditWidgetModal widget={widget} onClose={() => setOpen(false)} /> : null}
        </>
    );
}
