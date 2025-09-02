import { useCallback, useRef } from "react";

export function useDebouncedCallback(delay: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    return useCallback(
        (fn: () => void) => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(fn, delay);
        },
        [delay]
    );
}
