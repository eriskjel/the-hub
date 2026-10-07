"use client";

import { useActionState, useState, type ReactElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FieldText } from "@/components/ui/Fields";
import { mediaMemberAction } from "@/lib/admin/mediaMember.actions";
import {
    DEFAULT_WEEKLY_QUOTA,
    LIBRARY_ACCOUNT_MAX_LENGTH,
    LIBRARY_ACCOUNT_PATTERN,
    MAX_WEEKLY_QUOTA,
    isActiveMember,
    type MediaMember,
    type MemberActionError,
    type MemberActionState,
} from "@/lib/media/member";

const IDLE: MemberActionState = { status: "idle" };

// Fixed so the server and the browser render the same date.
const OSLO_TZ = "Europe/Oslo";

const ACCOUNT_ERRORS: MemberActionError[] = [
    "invalid_account",
    "account_required",
    "account_taken",
];

export default function MediaAccessCard({
    userId,
    member,
    targetIsAdmin,
}: {
    userId: string;
    member: MediaMember | null;
    targetIsAdmin: boolean;
}): ReactElement {
    const t = useTranslations("admin.users.detail.media");
    const locale = useLocale();
    const [state, dispatch, pending] = useActionState(mediaMemberAction, IDLE);
    const [account, setAccount] = useState(member?.libraryAccount ?? "");
    const [quota, setQuota] = useState(String(member?.weeklyQuota ?? DEFAULT_WEEKLY_QUOTA));

    const active = isActiveMember(member);
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(locale, { dateStyle: "medium", timeZone: OSLO_TZ });

    const status = active
        ? t("status_active", { date: formatDate(member.grantedAt) })
        : member?.revokedAt
          ? t("status_revoked", { date: formatDate(member.revokedAt) })
          : t("status_none");

    const error = state.status === "error" ? state.error : null;
    const accountError = error && ACCOUNT_ERRORS.includes(error) ? t(`errors.${error}`) : undefined;
    const quotaError = error === "invalid_quota" ? t(`errors.${error}`) : undefined;
    const formError = error && !accountError && !quotaError ? t(`errors.${error}`) : undefined;

    return (
        <div className="border-border bg-surface rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-foreground font-semibold">{t("title")}</h2>
                <span className="text-muted text-sm">{status}</span>
            </div>

            <form action={dispatch} className="space-y-3">
                <input type="hidden" name="userId" value={userId} />
                <FieldText
                    label={t("library_account")}
                    help={t("library_account_help")}
                    name="libraryAccount"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    pattern={LIBRARY_ACCOUNT_PATTERN}
                    maxLength={LIBRARY_ACCOUNT_MAX_LENGTH}
                    required={!targetIsAdmin}
                    autoComplete="off"
                    spellCheck={false}
                    error={accountError}
                />
                <FieldText
                    label={t("weekly_quota")}
                    name="weeklyQuota"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_WEEKLY_QUOTA}
                    step={1}
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                    required
                    error={quotaError}
                />

                <p role="status" aria-live="polite" className="min-h-5 text-sm">
                    {formError ? (
                        <span className="text-error">{formError}</span>
                    ) : state.status === "saved" || state.status === "revoked" ? (
                        <span className="text-muted">{t(state.status)}</span>
                    ) : null}
                </p>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="submit"
                        name="intent"
                        value="save"
                        variant="primary"
                        disabled={pending}
                    >
                        {active ? t("save") : t("grant")}
                    </Button>
                    {active && (
                        <Button
                            type="submit"
                            name="intent"
                            value="revoke"
                            variant="destructive"
                            formNoValidate
                            disabled={pending}
                        >
                            {t("revoke")}
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
