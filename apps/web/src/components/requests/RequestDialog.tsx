"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FieldRow, Help, Label } from "@/components/ui/Fields";
import { Modal } from "@/components/ui/Modal";
import { useRequestAction } from "@/components/requests/RequestButton";
import { requestMovie } from "@/lib/media/requests.actions";
import { NOTE_MAX_LENGTH, REMOVE_AFTER_DAYS } from "@/lib/media/request";

/**
 * Requests a title, with an optional note for the admin, and optionally only
 * for a while (REMOVE_AFTER_DAYS once it's added). The dialog closes
 * once the request is answered, and stays open to try again if it failed.
 */
export function RequestDialog({
    tmdbId,
    title,
    onChanged,
}: {
    tmdbId: number;
    title: string;
    /** Called after the request changed something. */
    onChanged?: () => void;
}): ReactElement {
    const t = useTranslations("requests");
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [temporary, setTemporary] = useState(false);
    const { pending, run } = useRequestAction(onChanged);
    const noteId = useId();
    const noteRef = useRef<HTMLTextAreaElement>(null);
    const close = () => !pending && setOpen(false);

    // Not autoFocus: the modal attaches its portal in an effect, after autoFocus has run.
    useEffect(() => {
        if (open) noteRef.current?.focus();
    }, [open]);

    return (
        <>
            <Button
                type="button"
                variant="primary"
                onClick={() => setOpen(true)}
                aria-label={t("actions.requestTitle", { title })}
            >
                {t("actions.request")}
            </Button>
            {open && (
                <Modal title={t("dialog.title", { title })} onClose={close}>
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(
                                () => requestMovie(tmdbId, { note, temporary }),
                                (result) =>
                                    (result.ok || result.error !== "failed") && setOpen(false)
                            );
                        }}
                    >
                        <FieldRow>
                            <Label htmlFor={noteId}>{t("dialog.note")}</Label>
                            <textarea
                                ref={noteRef}
                                id={noteId}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={NOTE_MAX_LENGTH}
                                rows={3}
                                placeholder={t("dialog.notePlaceholder")}
                                aria-describedby={`${noteId}-help`}
                                className="border-border bg-surface text-foreground placeholder-muted focus:border-border-subtle focus:ring-primary/20 w-full resize-y rounded-xl border px-3 py-2 outline-none focus:ring-2"
                            />
                            <Help id={`${noteId}-help`}>{t("dialog.noteHelp")}</Help>
                        </FieldRow>
                        <div className="space-y-0.5">
                            <label className="flex items-start gap-2.5 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    checked={temporary}
                                    onChange={(e) => setTemporary(e.target.checked)}
                                    aria-describedby={`${noteId}-temporary`}
                                    className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                                />
                                {t("dialog.temporary", { days: String(REMOVE_AFTER_DAYS) })}
                            </label>
                            <p
                                id={`${noteId}-temporary`}
                                className="text-muted-subtle pl-6.5 text-xs"
                            >
                                {t("dialog.temporaryHelp")}
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={close}
                                disabled={pending}
                            >
                                {t("dialog.back")}
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={pending}
                                aria-busy={pending || undefined}
                            >
                                {t("dialog.send")}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}
