import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { RequestButton } from "@/components/requests/RequestButton";
import { RequestDialog } from "@/components/requests/RequestDialog";
import {
    isCancellable,
    isOpenStatus,
    type RequestRole,
    type RequestStatus,
} from "@/lib/media/request";
import { removalAhead } from "@/lib/media/removal";

/**
 * What the member can do with a title: request it, "+1" it, take the "+1"
 * back, cancel their own request, or keep a temporary one. Used by search
 * results and the queue.
 */
export function RequestControls({
    tmdbId,
    title,
    request,
    onChanged,
}: {
    tmdbId: number;
    title: string;
    request: {
        id: number;
        status: RequestStatus;
        role: RequestRole;
        /** Only the queue knows; search results leave it out. */
        removal?: { at: string | null } | null;
    } | null;
    /** Called after an action here changed something. */
    onChanged?: () => void;
}): ReactElement | null {
    const t = useTranslations("requests.actions");

    if (!request) {
        return <RequestDialog tmdbId={tmdbId} title={title} onChanged={onChanged} />;
    }
    if (request.role === "requester") {
        const keep = removalAhead(request.status, request.removal);
        const cancel = isCancellable(request.status);
        if (!keep && !cancel) return null;
        return (
            <div className="flex shrink-0 items-center gap-1.5">
                {keep && (
                    <RequestButton
                        action="keep"
                        id={request.id}
                        variant="ghost"
                        label={t("keepTitle", { title })}
                        onChanged={onChanged}
                    >
                        {t("keep")}
                    </RequestButton>
                )}
                {cancel && (
                    <RequestButton
                        action="cancel"
                        id={request.id}
                        variant="ghost"
                        label={t("cancelTitle", { title })}
                        onChanged={onChanged}
                    >
                        {t("cancel")}
                    </RequestButton>
                )}
            </div>
        );
    }
    if (request.role === "follower") {
        return (
            <RequestButton
                action="unfollow"
                id={request.id}
                variant="ghost"
                label={t("unfollowTitle", { title })}
                onChanged={onChanged}
            >
                {t("unfollow")}
            </RequestButton>
        );
    }
    // A +1 on a title that's about to leave the library keeps it.
    const leaving = request.status === "available" && removalAhead(request.status, request.removal);
    return isOpenStatus(request.status) || leaving ? (
        <RequestButton
            action="request"
            id={tmdbId}
            label={t("plusOneTitle", { title })}
            onChanged={onChanged}
        >
            {t("plusOne")}
        </RequestButton>
    ) : null;
}
