"use client";

import type { ReactElement } from "react";
import GlassCard from "@/components/ui/GlassCard";

export default function WidgetCardSkeleton(): ReactElement {
    return (
        <GlassCard
            header={
                <div className="relative h-4 w-44">
                    <span
                        aria-hidden
                        className="bg-surface-light absolute inset-0 animate-pulse rounded"
                    />
                </div>
            }
            actions={
                <div className="flex items-center gap-2">
                    <div className="bg-surface-light h-7 w-7 rounded" />
                    <div className="bg-surface-light h-7 w-7 rounded" />
                </div>
            }
            variant="solid"
            tone="light"
            stale={false}
        >
            <div className="relative min-h-[144px] w-full">
                <span
                    aria-hidden
                    className="bg-surface-subtle absolute inset-0 animate-pulse rounded-lg"
                />
            </div>
        </GlassCard>
    );
}
