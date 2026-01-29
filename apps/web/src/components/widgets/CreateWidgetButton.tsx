"use client";

import { ReactElement, useState } from "react";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/utils/cn";

export default function CreateWidgetButton({ className }: { className?: string }): ReactElement {
    const t = useTranslations("widgets.create");
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "bg-primary hover:bg-primary-muted focus:ring-primary-muted inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)] focus:outline-none",
                    className
                )}
            >
                <Plus className="h-4 w-4" aria-hidden />
                {t("title")}
            </button>
            {open ? <CreateWidgetModal onClose={() => setOpen(false)} /> : null}
        </>
    );
}
