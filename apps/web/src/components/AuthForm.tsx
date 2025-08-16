"use client";

import { login, signup } from "@/app/auth/actions/auth";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ReactElement, ReactNode, useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { startGithubOAuth } from "@/utils/auth/startGithubOAuth";
import { useAuthMode } from "@/hooks/useAuthMode";

const ERROR_KEY_BY_CODE = {
    "invalid-credentials": "invalidCredentials",
    "signup-failed": "signupFailed",
    "confirm-failed": "confirmFailed",
} as const;

type ErrorCode = keyof typeof ERROR_KEY_BY_CODE;
type ErrorKey = (typeof ERROR_KEY_BY_CODE)[ErrorCode] | "generic";

export default function AuthForm(): ReactElement {
    const locale = useLocale();
    const t = useTranslations("login");

    const searchParams = useSearchParams();
    const errorCode = searchParams.get("error") as ErrorCode | null;
    const errorKey: ErrorKey = (errorCode && ERROR_KEY_BY_CODE[errorCode]) ?? "generic";
    const errorMessage = errorCode ? t(`errors.${errorKey}`) : null;

    const handleGithub = useCallback(() => startGithubOAuth(locale), [locale]);

    const { isLogin, switchTo } = useAuthMode();

    const formAction = useMemo(() => (isLogin ? login : signup), [isLogin]);

    return (
        <div className="w-full max-w-sm text-center">
            <h1 className="mb-2 text-4xl font-bold">{isLogin ? t("title") : t("registerTitle")}</h1>
            <p className="mb-4 text-sm text-gray-500">
                {isLogin ? t("subtitleLogin") : t("subtitleSignup")}
            </p>

            <ErrorAlert message={errorMessage} />

            <form action={formAction} className="space-y-4" autoComplete="on">
                {!isLogin && (
                    <Field
                        id="name"
                        label={t("name")}
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                    />
                )}

                <Field
                    id="email"
                    label={t("email")}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                />

                <Field
                    id="password"
                    label={t("password")}
                    name="password"
                    type="password"
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                />

                {!isLogin && (
                    <Field
                        id="confirmPassword"
                        label={t("confirmPassword")}
                        name="confirmPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                    />
                )}

                {/* Single submit, full width */}
                <SubmitButton t={t}>{isLogin ? t("login") : t("register")}</SubmitButton>
            </form>

            <Divider label={t("or")} />

            {/* GitHub (separate action) */}
            <button
                onClick={handleGithub}
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
            >
                <img src="/icons/github-mark-white.svg" alt="Github logo" className="h-5 w-5" />
                {t("github")}
            </button>

            {/* Under-text switch */}
            <p className="mt-3 text-sm text-gray-600">
                {isLogin ? t("noAccount") : t("haveAccount")}{" "}
                <button
                    type="button"
                    onClick={() => switchTo(isLogin ? "signup" : "login")}
                    className="cursor-pointer text-blue-600 hover:underline"
                >
                    {isLogin ? t("goToRegister") : t("goToLogin")}
                </button>
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

function Divider({ label }: { label: string }): ReactElement {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">{label}</span>
            <div className="h-px flex-1 bg-gray-200" />
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
