import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "../useDebouncedCallback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("cancels scheduled work and can schedule new work afterward", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(300));
    result.current.debounce(callback);
    result.current.cancel();
    act(() => vi.advanceTimersByTime(300));
    expect(callback).not.toHaveBeenCalled();

    result.current.debounce(callback);
    act(() => vi.advanceTimersByTime(300));
    expect(callback).toHaveBeenCalledOnce();
});

it("cancels scheduled work on unmount", () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(300));
    result.current.debounce(callback);
    unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(callback).not.toHaveBeenCalled();
});
