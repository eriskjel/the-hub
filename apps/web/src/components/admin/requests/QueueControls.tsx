"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Check, CircleCheck, Ellipsis, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import {
    adminRequestAction,
    approveRequestOption,
    setProcessingPaused,
} from "@/lib/admin/mediaQueue.actions";
import {
    NEEDS_ADMIN_STATUSES,
    adminRequestIntents,
    type AdminMediaResult,
    type AdminRequestIntent,
} from "@/lib/media/admin";
import type { QueueItem } from "@/lib/media/queue.server";
import { cn } from "@/utils/cn";

function useAdminUpdate() {
    const t = useTranslations("admin.requests");
    const [pending, startTransition] = useTransition();
    const run = (action: () => Promise<AdminMediaResult>) =>
        startTransition(async () => {
            try {
                const result = await action();
                if (result.ok) toast.success(t(`outcomes.${result.outcome}`));
                else toast.error(t(`errors.${result.error}`));
            } catch {
                toast.error(t("errors.failed"));
            }
        });
    return { pending, run };
}

const INTENT_ICONS: Record<AdminRequestIntent, LucideIcon> = {
    available: CircleCheck,
    requeue: RotateCcw,
    decline: Ban,
};

/**
 * A request waiting for the admin gets one main action; everything else the
 * status allows is an override in the row's menu. When the admin chooses
 * among the proposed options instead, every action here is an override.
 */
export function QueueControls({
    item,
    title,
    choosing = false,
}: {
    item: QueueItem;
    title: string;
    choosing?: boolean;
}) {
    const t = useTranslations("admin.requests.actions");
    const { pending, run } = useAdminUpdate();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            menuRef.current?.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus();
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    const intents = adminRequestIntents(item.status);
    if (!intents.length) return null;
    const primary: AdminRequestIntent | null =
        NEEDS_ADMIN_STATUSES.includes(item.status) && !choosing ? "available" : null;
    const overrides = intents.filter((intent) => intent !== primary);
    // Any action closes the menu, and its trigger stays disabled until the save ends.
    const act = (intent: AdminRequestIntent) => {
        setOpen(false);
        run(() => adminRequestAction(item.id, intent, item.updatedAt));
    };

    return (
        <div className="flex shrink-0 items-center gap-1.5">
            {primary && (
                <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    aria-busy={pending || undefined}
                    aria-label={t(`${primary}Title`, { title })}
                    onClick={() => act(primary)}
                >
                    <Check aria-hidden className="h-4 w-4" />
                    {t(primary)}
                </Button>
            )}
            <div ref={menuRef} className="relative">
                <IconButton
                    type="button"
                    disabled={pending}
                    aria-label={t("more", { title })}
                    aria-expanded={open}
                    aria-controls={open ? menuId : undefined}
                    onClick={() => setOpen(!open)}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Ellipsis aria-hidden className="h-5 w-5" />
                </IconButton>
                {open && (
                    <div
                        id={menuId}
                        className="border-border bg-surface absolute top-full right-0 z-10 mt-1 w-52 rounded-xl border py-1 shadow-lg"
                    >
                        {overrides.map((intent) => {
                            const Icon = INTENT_ICONS[intent];
                            return (
                                <button
                                    key={intent}
                                    type="button"
                                    aria-label={t(`${intent}Title`, { title })}
                                    onClick={() => act(intent)}
                                    className={cn(
                                        "hover:bg-surface-subtle focus-visible:bg-surface-subtle flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition-colors focus:outline-none",
                                        intent === "decline"
                                            ? "text-error-strong"
                                            : "text-foreground"
                                    )}
                                >
                                    <Icon
                                        aria-hidden
                                        className={cn(
                                            "h-4 w-4",
                                            intent !== "decline" && "text-muted"
                                        )}
                                    />
                                    {t(intent)}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Approves one proposed option, which the worker then adds. */
export function ChooseOption({
    item,
    rank,
    label,
    title,
}: {
    item: QueueItem;
    rank: number;
    label: string;
    title: string;
}) {
    const t = useTranslations("admin.requests.actions");
    const { pending, run } = useAdminUpdate();
    return (
        <Button
            type="button"
            variant={rank === 1 ? "primary" : "secondary"}
            disabled={pending}
            aria-busy={pending || undefined}
            aria-label={t("chooseTitle", { label, title })}
            onClick={() => run(() => approveRequestOption(item.id, rank, item.updatedAt))}
            className="shrink-0 self-center"
        >
            {t("choose")}
        </Button>
    );
}

export function ProcessingToggle({ paused }: { paused: boolean }) {
    const t = useTranslations("admin.requests.worker");
    const { pending, run } = useAdminUpdate();
    return (
        <Button
            type="button"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => run(() => setProcessingPaused(!paused, paused))}
        >
            {t(paused ? "resume" : "pause")}
        </Button>
    );
}
