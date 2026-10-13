import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { RequestButton } from "@/components/requests/RequestButton";
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
}: {
    tmdbId: number;
    title: string;
    request: { id: number; status: RequestStatus; role: RequestRole } | null;
}): ReactElement | null {
    const t = useTranslations("requests.actions");

    if (!request) {
        return (
            <RequestButton action="request" id={tmdbId} label={t("requestTitle", { title })}>
                {t("request")}
            </RequestButton>
        );
    }
    if (request.role === "requester") {
        return isCancellable(request.status) ? (
            <RequestButton
                action="cancel"
                id={request.id}
                variant="ghost"
                label={t("cancelTitle", { title })}
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
            >
                {t("unfollow")}
            </RequestButton>
        );
    }
    return isOpenStatus(request.status) ? (
        <RequestButton action="request" id={tmdbId} label={t("plusOneTitle", { title })}>
            {t("plusOne")}
        </RequestButton>
    ) : null;
}
