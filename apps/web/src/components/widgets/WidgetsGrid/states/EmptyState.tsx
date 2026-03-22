"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";
import CreateWidgetModal from "@/components/widgets/_internal/CreateWidgetModal";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";

export default function EmptyState(): ReactElement {
    const t = useTranslations("dashboard.states");
    const [groceryOpen, setGroceryOpen] = useState(false);

    return (
        <section className="py-1">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <CreateWidgetButton />
                    <button
                        onClick={() => setGroceryOpen(true)}
                        className="text-foreground hover:bg-surface-light inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                    >
                        <ShoppingCart className="h-4 w-4" aria-hidden />
                        {t("emptyGroceryShortcut")}
                    </button>
                </div>
                <div className="widget-glass w-full rounded-2xl p-8">
                    <h3 className="text-foreground mb-2 text-lg font-semibold">
                        {t("emptyTitle")}
                    </h3>
                    <p className="text-muted text-sm">{t("emptyBody")}</p>
                </div>
                {groceryOpen && (
                    <CreateWidgetModal
                        initialKind="grocery-deals"
                        onClose={() => setGroceryOpen(false)}
                    />
                )}
            </div>
        </section>
    );
}
