"use client";

import { useState } from "react";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";
import { useTranslations } from "next-intl";

export default function CreateWidgetButton() {
    const t = useTranslations("widgets.create");
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-black shadow hover:bg-white/90"
            >
                {t("title")}
            </button>
            {open ? <CreateWidgetModal onClose={() => setOpen(false)} /> : null}
        </>
    );
}
