import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { refresh, router } = vi.hoisted(() => {
    const refresh = vi.fn();
    return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { QueueRefresh } from "../QueueRefresh";

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

it("refreshes visible queues once per minute and cleans up on unmount", () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { unmount } = render(<QueueRefresh />);
    act(() => vi.advanceTimersByTime(59_999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledOnce();
    unmount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledOnce();
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledOnce();
});

it("skips hidden tabs and refreshes when returning to the queue", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    render(<QueueRefresh />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledOnce();
});
