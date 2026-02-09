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
                        className="absolute inset-0 animate-pulse rounded bg-surface-light"
                    />
                </div>
            }
            actions={
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded bg-surface-light" />
                    <div className="h-7 w-7 rounded bg-surface-light" />
                </div>
            }
            variant="solid"
            tone="light"
            stale={false}
        >
            <div className="relative min-h-[144px] w-full">
                <span
                    aria-hidden
                    className="absolute inset-0 animate-pulse rounded-lg bg-surface-subtle"
                />
            </div>
        </GlassCard>
    );
}
