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

/**
 * What the member can do with a title: request it, "+1" it, take the "+1"
 * back, or cancel their own request. Used by search results and the queue.
 */
export function RequestControls({
    tmdbId,
    title,
    request,
    onChanged,
}: {
    tmdbId: number;
    title: string;
    request: { id: number; status: RequestStatus; role: RequestRole } | null;
    /** Called after an action here changed something. */
    onChanged?: () => void;
}): ReactElement | null {
    const t = useTranslations("requests.actions");

    if (!request) {
        return <RequestDialog tmdbId={tmdbId} title={title} onChanged={onChanged} />;
    }
    if (request.role === "requester") {
        return isCancellable(request.status) ? (
            <RequestButton
                action="cancel"
                id={request.id}
                variant="ghost"
                label={t("cancelTitle", { title })}
                onChanged={onChanged}
            >
                {t("cancel")}
            </RequestButton>
        ) : null;
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
    return isOpenStatus(request.status) ? (
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
