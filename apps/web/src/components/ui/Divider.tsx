import { ReactElement } from "react";

export function Divider({ label }: { label: string }): ReactElement {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">{label}</span>
            <div className="h-px flex-1 bg-gray-200" />
        </div>
    );
}
