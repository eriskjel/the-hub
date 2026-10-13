import { useCallback, useEffect, useRef } from "react";

export function useDebouncedCallback(delay: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancel = useCallback(() => {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
    }, []);
    useEffect(() => cancel, [cancel, delay]);

    const debounce = useCallback(
        (fn: () => void) => {
            cancel();
            timer.current = setTimeout(() => {
                timer.current = null;
                fn();
            }, delay);
        },
        [cancel, delay]
    );
    return { debounce, cancel };
}
