"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { adminRequestAction, setProcessingPaused } from "@/lib/admin/mediaQueue.actions";
import { adminRequestIntents, type AdminMediaResult } from "@/lib/media/admin";
import type { QueueItem } from "@/lib/media/queue.server";

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

export function QueueControls({ item, title }: { item: QueueItem; title: string }) {
    const t = useTranslations("admin.requests.actions");
    const { pending, run } = useAdminUpdate();
    const intents = adminRequestIntents(item.status);
    if (!intents.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {intents.map((intent) => (
                <Button
                    key={intent}
                    type="button"
                    variant={intent === "decline" ? "destructive" : "secondary"}
                    disabled={pending}
                    aria-busy={pending || undefined}
                    aria-label={t(`${intent}Title`, { title })}
                    onClick={() => run(() => adminRequestAction(item.id, intent, item.updatedAt))}
                >
                    {t(intent)}
                </Button>
            ))}
        </div>
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
