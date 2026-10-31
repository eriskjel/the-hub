"use client";

import {
    createContext,
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
    useTransition,
    type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { setRequestRetention } from "@/lib/admin/mediaQueue.actions";
import type { QueueItem } from "@/lib/media/queue.server";
import { retentionSchema, type RetentionChoice } from "@/lib/media/retention";

const initialChoice = (item: QueueItem): RetentionChoice =>
    item.retention?.policy === "remove"
        ? { policy: "remove", days: item.retention.days ?? 30 }
        : { policy: item.retention?.policy ?? "requester" };

const ApprovalContext = createContext<{
    choice: RetentionChoice;
    setChoice: (choice: RetentionChoice) => void;
} | null>(null);

export function RetentionProvider({ item, children }: { item: QueueItem; children: ReactNode }) {
    const [choice, setChoice] = useState<RetentionChoice>(() => initialChoice(item));
    return (
        <ApprovalContext value={item.retention ? { choice, setChoice } : null}>
            {children}
        </ApprovalContext>
    );
}
export const useApprovalRetention = () => useContext(ApprovalContext);

function RetentionFields({
    choice,
    onChange,
    available = false,
    removable = true,
    disabled = false,
}: {
    choice: RetentionChoice;
    onChange: (choice: RetentionChoice) => void;
    available?: boolean;
    removable?: boolean;
    disabled?: boolean;
}) {
    const t = useTranslations("admin.requests.retention");
    const id = useId();
    return (
        <fieldset disabled={disabled} className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">{t("label")}</legend>
            <select
                aria-label={t("label")}
                value={choice.policy}
                onChange={(e) =>
                    onChange(
                        e.target.value === "remove"
                            ? { policy: "remove", days: 30 }
                            : { policy: e.target.value as "keep" | "requester" }
                    )
                }
                className="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
            >
                <option value="requester">{t("requester")}</option>
                <option value="keep">{t("keep")}</option>
                <option value="remove" disabled={!removable}>
                    {t("remove")}
                </option>
            </select>
            {choice.policy === "remove" && (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {[7, 30, 90].map((days) => (
                            <Button
                                key={days}
                                type="button"
                                variant={choice.days === days ? "primary" : "secondary"}
                                onClick={() => onChange({ policy: "remove", days })}
                            >
                                {t("preset", { days })}
                            </Button>
                        ))}
                    </div>
                    <label htmlFor={id} className="block text-sm">
                        {t("days")}
                    </label>
                    <input
                        id={id}
                        type="number"
                        required
                        min={1}
                        max={365}
                        step={1}
                        value={Number.isNaN(choice.days) ? "" : choice.days}
                        onChange={(e) =>
                            onChange({ policy: "remove", days: e.target.valueAsNumber })
                        }
                        aria-describedby={`${id}-help`}
                        className="border-border bg-surface w-24 rounded-lg border px-3 py-2"
                    />
                    <p id={`${id}-help`} className="text-muted text-xs">
                        {t(available ? "fromNow" : "fromAvailable")}
                    </p>
                </div>
            )}
            {!removable && <p className="text-muted text-xs">{t("protected")}</p>}
            {choice.policy !== "requester" && <p className="text-muted text-xs">{t("finalSay")}</p>}
        </fieldset>
    );
}

export function ApprovalRetention() {
    const context = useApprovalRetention();
    return (
        context && (
            <div className="border-border rounded-xl border p-3">
                <RetentionFields choice={context.choice} onChange={context.setChoice} />
            </div>
        )
    );
}

export function RetentionDialog({
    item,
    title,
    onClose,
}: {
    item: QueueItem;
    title: string;
    onClose: () => void;
}) {
    const t = useTranslations("admin.requests");
    const [choice, setChoice] = useState(() => initialChoice(item));
    const [pending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);
    const close = () => !pending && onClose();

    // Not autoFocus: the modal attaches its portal in an effect, after autoFocus has run.
    useEffect(() => {
        formRef.current?.querySelector("select")?.focus();
    }, []);
    return (
        <Modal title={t("retention.title", { title })} onClose={close}>
            <form
                ref={formRef}
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!retentionSchema.safeParse(choice).success) return;
                    startTransition(async () => {
                        try {
                            const result = await setRequestRetention(
                                item.id,
                                item.updatedAt,
                                choice
                            );
                            if (result.ok) {
                                toast.success(t(`outcomes.${result.outcome}`));
                                onClose();
                            } else {
                                toast.error(t(`errors.${result.error}`));
                                if (result.error === "changed") onClose();
                            }
                        } catch {
                            toast.error(t("errors.failed"));
                        }
                    });
                }}
            >
                <RetentionFields
                    choice={choice}
                    onChange={setChoice}
                    available={item.status === "available"}
                    removable={item.status !== "available" || item.retention?.eligible === true}
                    disabled={pending}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                        {t("retention.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={pending || !retentionSchema.safeParse(choice).success}
                        aria-busy={pending || undefined}
                    >
                        {t("retention.save")}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
