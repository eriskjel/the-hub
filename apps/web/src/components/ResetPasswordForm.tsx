"use client";

import { updatePassword } from "@/app/auth/actions/auth";
import { getAuthErrorMessage, type AuthErrorCode } from "@/utils/auth/errorCodes";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ReactElement, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function ResetPasswordForm(): ReactElement {
    const locale = useLocale();
    const t = useTranslations("login");
    const searchParams = useSearchParams();
    const errorCode = searchParams.get("error") as AuthErrorCode | null;
    const errorMessage = getAuthErrorMessage(t, errorCode);

    return (
        <div className="w-full max-w-sm text-center">
            <h1 className="mb-2 text-4xl font-bold">{t("resetPasswordTitle")}</h1>
            <p className="mb-4 text-sm text-gray-500">{t("resetPasswordSubtitle")}</p>

            <ErrorAlert message={errorMessage} />

            <form action={updatePassword} className="space-y-4" autoComplete="on">
                <Field
                    id="password"
                    label={t("password")}
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <Field
                    id="confirmPassword"
                    label={t("confirmPassword")}
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <SubmitButton t={t}>{t("saveNewPassword")}</SubmitButton>
            </form>

            <p className="mt-3 text-sm text-gray-600">
                <Link
                    href={`/${locale}/login`}
                    className="cursor-pointer text-blue-600 hover:underline"
                >
                    {t("backToLogin")}
                </Link>
            </p>
        </div>
    );
}

function Field(props: {
    id: string;
    label: string;
    name: string;
    type: string;
    required?: boolean;
    autoComplete?: string;
}): ReactElement {
    const { id, label, name, type, required, autoComplete } = props;
    return (
        <div className="space-y-1 text-left">
            <label htmlFor={id} className="block text-sm font-medium">
                {label}
            </label>
            <input
                id={id}
                name={name}
                type={type}
                required={required}
                autoComplete={autoComplete}
                className="w-full rounded border border-gray-300 px-3 py-2"
            />
        </div>
    );
}

function SubmitButton({
    children,
    t,
}: {
    children: ReactNode;
    t: (k: string) => string;
}): ReactElement {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            aria-busy={pending}
        >
            {pending ? t("working") : children}
        </button>
    );
}

function ErrorAlert({ message }: { message?: string | null }): ReactElement | null {
    if (!message) return null;
    return <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{message}</p>;
}
