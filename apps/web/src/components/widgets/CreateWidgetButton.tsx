"use client";

import { ReactElement, useState } from "react";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";
import { useTranslations } from "next-intl";
import { cn } from "@/utils/cn";

export default function CreateWidgetButton({ className }: { className?: string }): ReactElement {
    const t = useTranslations("widgets.create");
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "cursor-pointer rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-black shadow hover:bg-white/90",
                    className
                )}
            >
                {t("title")}
            </button>
            {open ? <CreateWidgetModal onClose={() => setOpen(false)} /> : null}
        </>
    );
}
