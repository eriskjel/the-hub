"use client";

import { useTransition, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import {
    cancelRequest,
    keepRequest,
    requestMovie,
    unfollowRequest,
} from "@/lib/media/requests.actions";
import type { RequestActionResult, RequestOutcome } from "@/lib/media/request";

export const SEARCH_QUERY_KEY = "media-search";

const ACTIONS = {
    request: requestMovie,
    cancel: cancelRequest,
    unfollow: unfollowRequest,
    keep: keepRequest,
} satisfies Record<string, (id: number) => Promise<RequestActionResult>>;

/** Outcomes where nothing changed: shown as info, not success. */
const NO_CHANGE: RequestOutcome[] = [
    "already_requested",
    "already_following",
    "available",
    "closed",
];

/**
 * Runs request actions and reports each result in a toast. The action
 * refreshes the page's queue; open search results are refetched here.
 * `onChanged` runs after an action changed something (not for errors or
 * "already done"), `after` after every run.
 */
export function useRequestAction(onChanged?: () => void) {
    const t = useTranslations("requests");
    const queryClient = useQueryClient();
    const [pending, startTransition] = useTransition();

    const run = (
        action: () => Promise<RequestActionResult>,
        after?: (result: RequestActionResult) => void
    ) =>
        startTransition(async () => {
            let result: RequestActionResult;
            try {
                result = await action();
            } catch {
                result = { ok: false, error: "failed" };
            }
            const changed = result.ok && !NO_CHANGE.includes(result.outcome);
            if (!result.ok) {
                toast.error(t(`errors.${result.error}`));
            } else if (changed) {
                toast.success(t(`outcomes.${result.outcome}`));
            } else {
                toast.info(t(`outcomes.${result.outcome}`));
            }
            await queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY] });
            after?.(result);
            if (changed) onChanged?.();
        });

    return { pending, run };
}

/** Runs one request action. */
export function RequestButton({
    action,
    id,
    variant = "primary",
    label,
    onChanged,
    children,
}: {
    action: keyof typeof ACTIONS;
    /** A TMDB id for `request`, a request id otherwise. */
    id: number;
    variant?: ButtonVariant;
    /** Accessible name when the visible text alone is ambiguous (e.g. "+1"). */
    label?: string;
    /** Called after the action changed something (not for errors or "already done"). */
    onChanged?: () => void;
    children: ReactNode;
}): ReactElement {
    const { pending, run } = useRequestAction(onChanged);

    return (
        <Button
            type="button"
            variant={variant}
            onClick={() => run(() => ACTIONS[action](id))}
            disabled={pending}
            aria-label={label}
            aria-busy={pending || undefined}
        >
            {children}
        </Button>
    );
}
