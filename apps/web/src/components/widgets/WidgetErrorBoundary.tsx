"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { WidgetErrorBox } from "@/components/widgets/WidgetErrorBox";

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/** Per-widget error boundary. Catches render-time errors thrown by widget components
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
