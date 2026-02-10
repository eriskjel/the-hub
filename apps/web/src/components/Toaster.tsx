"use client";

import type { ReactElement } from "react";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster(): ReactElement {
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
