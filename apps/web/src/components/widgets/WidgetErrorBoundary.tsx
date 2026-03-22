"use client";

import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { HttpError } from "@/lib/widgets/fetchJson";

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/** Per-widget error boundary. Catches useSuspenseQuery initial load failures
 *  and renders an inline error message inside the card content area. */
export default class WidgetErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[WidgetErrorBoundary]", error, info.componentStack);
    }

    render(): ReactNode {
        const { error } = this.state;
        if (error) return <WidgetErrorBox error={error} />;
        return this.props.children;
    }
}

function WidgetErrorBox({ error }: { error: Error }): ReactElement {
    const is404 = error instanceof HttpError && error.status === 404;
    const msg = is404 ? "Widget not found" : "Failed to load widget";
    return (
        <div className="border-error-muted bg-error-subtle text-error rounded-lg border p-3 text-sm">
            {msg}
        </div>
    );
}
