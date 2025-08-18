"use client";

import type { ReactElement } from "react";

export default function ErrorState({ error }: { error: string }): ReactElement {
    return (
        <section className="py-10">
            <div className="mx-auto max-w-md text-center">
                <div className="inline-block rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                    <h3 className="mb-2 text-lg font-semibold">Unable to Load Dashboard</h3>
                    <p className="text-sm">
                        {process.env.NODE_ENV === "development" ? error : "An error occurred."}
                    </p>
                    <p className="mt-2 text-xs text-red-400">Please try refreshing the page.</p>
                </div>
            </div>
        </section>
    );
}
