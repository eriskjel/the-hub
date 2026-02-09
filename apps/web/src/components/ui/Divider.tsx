import { ReactElement } from "react";

export function Divider({ label }: { label: string }): ReactElement {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">{label}</span>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}
