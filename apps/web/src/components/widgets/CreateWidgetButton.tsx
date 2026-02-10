"use client";

import { ReactElement, useState } from "react";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/utils/cn";

export default function CreateWidgetButton({
    className,
    backendUnreachable = false,
}: {
    className?: string;
    backendUnreachable?: boolean;
}): ReactElement {
    const t = useTranslations("widgets.create");
    const tStates = useTranslations("dashboard.states");
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
            <button
                onClick={handleClick}
                className={cn(
                    "bg-cta hover:bg-cta-muted focus:ring-cta-muted focus:ring-offset-background inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none",
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
