"use client";

import type { ReactElement } from "react";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";

export default function EmptyState(): ReactElement {
    return (
        <section className="py-1">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center text-neutral-300">
                <CreateWidgetButton label="Create your first widget" />
                <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                    <h3 className="mb-2 text-lg font-semibold">No widgets yet</h3>
                    <p className="text-sm text-neutral-400">
                        Add your first widget to get started.
                    </p>
                </div>
            </div>
        </section>
    );
}