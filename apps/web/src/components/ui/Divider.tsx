import { ReactElement } from "react";

export function Divider({ label }: { label: string }): ReactElement {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted text-xs">{label}</span>
            <div className="bg-border h-px flex-1" />
        </div>
    );
}
