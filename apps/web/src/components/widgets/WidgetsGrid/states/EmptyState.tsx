"use client";

import type { ReactElement } from "react";

export default function EmptyState(): ReactElement {
    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center text-neutral-300">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                    <h3 className="mb-2 text-lg font-semibold">No widgets yet</h3>
                    <p className="text-sm text-neutral-400">
                        Add your first widget to get started.
                    </p>
                </div>
            </div>
        </section>
    );
}
