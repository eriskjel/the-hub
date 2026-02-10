"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster(): React.ReactElement {
    return (
        <SonnerToaster
            richColors
            position="top-center"
            toastOptions={{
                style: { width: "fit-content", maxWidth: "min(calc(100vw - 2rem), 420px)" },
            }}
        />
    );
}
