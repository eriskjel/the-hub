"use client";

import { RefObject, useEffect } from "react";

type Options = {
    expanded: boolean;
    isMobileViewport: boolean;
    containerRef: RefObject<HTMLDivElement | null>;
    toggleButtonRef: RefObject<HTMLButtonElement | null>;
};

export function useMobileExpandScrollAdjust({
    expanded,
    isMobileViewport,
    containerRef,
    toggleButtonRef,
}: Options): void {
    useEffect(() => {
        if (!expanded || !isMobileViewport) return;

        const timerId = window.setTimeout(() => {
            const container = containerRef.current;
            const toggleBtn = toggleButtonRef.current;
            if (!container || !toggleBtn) return;

            const headerOffset = 88;
            const bottomComfortOffset = 112;
            const viewportHeight = window.innerHeight;

            const containerTop = container.getBoundingClientRect().top;
            const buttonBottom = toggleBtn.getBoundingClientRect().bottom;
            const desiredBottom = viewportHeight - bottomComfortOffset;
            const neededDownScroll = buttonBottom - desiredBottom;

            if (neededDownScroll <= 8) return;

            // Prevent over-scrolling that would push widget heading too far up.
            const maxAllowedByTop = Math.max(0, containerTop - headerOffset);
            const delta = Math.min(neededDownScroll, maxAllowedByTop, 360);
            if (delta <= 0) return;

            window.scrollBy({
                top: delta,
                behavior: "smooth",
            });
        }, 340);

        return () => window.clearTimeout(timerId);
    }, [expanded, isMobileViewport, containerRef, toggleButtonRef]);
}
