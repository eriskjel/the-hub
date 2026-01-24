import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";

/**
 * Cinemateket widget has no settings - it just displays upcoming films.
 */
export default function CinemateketSettings({
    form,
}: {
    form: UseFormReturn<{ kind: "cinemateket"; settings: Record<string, never> }>;
}): ReactElement {
    // No settings needed
    return (
        <div className="text-sm text-neutral-600">
            This widget displays upcoming film showings from Cinemateket Trondheim. No configuration
            needed.
        </div>
    );
}
