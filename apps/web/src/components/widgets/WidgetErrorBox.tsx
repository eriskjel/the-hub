import { type ReactElement } from "react";
import { HttpError } from "@/lib/widgets/fetchJson";

export function WidgetErrorBox({
    error,
    refetch,
}: {
    error: Error;
    refetch?: () => void;
}): ReactElement {
    const is404 = error instanceof HttpError && error.status === 404;
    const msg = is404 ? "Widget not found" : "Failed to load widget";
    return (
        <div className="border-error-muted bg-error-subtle text-error rounded-lg border p-3 text-sm">
            <span>{msg}</span>
            {!is404 && refetch && (
                <button
                    onClick={refetch}
                    className="text-error hover:text-error ml-2 underline underline-offset-2"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
