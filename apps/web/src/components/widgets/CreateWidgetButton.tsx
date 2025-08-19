"use client";
import { useState } from "react";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";

export default function CreateWidgetButton({ label = "Create a widget" }: { label?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-black shadow hover:bg-white/90"
            >
                {label}
            </button>
            {open ? <CreateWidgetModal onClose={() => setOpen(false)} /> : null}
        </>
    );
}
