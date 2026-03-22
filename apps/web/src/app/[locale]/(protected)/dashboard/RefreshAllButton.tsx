"use client";

import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

export function RefreshAllButton() {
    const queryClient = useQueryClient();
    const isFetching = useIsFetching({ queryKey: ["widget"] }) > 0;

    return (
        <button
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["widget"] })}
            aria-label="Refresh all widgets"
            title="Refresh all"
            className="cursor-pointer rounded-xl p-2.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
        </button>
    );
}
