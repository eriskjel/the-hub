import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import type { RequestStatus } from "@/lib/media/request";
import { cn } from "@/utils/cn";

const TONE: Record<RequestStatus, string> = {
    wanted: "bg-surface-subtle text-muted",
    searching: "bg-primary/15 text-primary",
    proposed: "bg-primary/15 text-primary",
    approved: "bg-primary/15 text-primary",
    downloading: "bg-primary/15 text-primary",
    available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-700 dark:text-red-400",
    declined: "bg-red-500/15 text-red-700 dark:text-red-400",
    cancelled: "bg-surface-subtle text-muted",
    removed: "bg-surface-subtle text-muted",
};

/** Members wait for a proposal to be approved; for the admin it's a suggestion to act on. */
export function StatusBadge({
    status,
    admin = false,
}: {
    status: RequestStatus;
    admin?: boolean;
}): ReactElement {
    const t = useTranslations("requests.status");
    return (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE[status])}>
            {t(admin && status === "proposed" ? "proposedAdmin" : status)}
        </span>
    );
}
