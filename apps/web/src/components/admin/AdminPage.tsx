import type { ReactNode } from "react";

export function AdminPage({
    title,
    description,
    eyebrow,
    actions,
    children,
}: {
    title: string;
    description?: string;
    eyebrow?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 space-y-2">
                    {eyebrow && <div className="text-muted text-sm">{eyebrow}</div>}
                    <h1 className="text-foreground text-3xl font-semibold tracking-tight break-words">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-muted max-w-2xl text-sm leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
                {actions}
            </header>
            {children}
        </div>
    );
}
