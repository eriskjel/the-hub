"use client";

import { login, requestPasswordReset, signup } from "@/app/auth/actions/auth";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { startGithubOAuth } from "@/utils/auth/startGithubOAuth";
import { useAuthMode } from "@/hooks/useAuthMode";
import Image from "next/image";
import Script from "next/script";
import { Divider } from "@/components/ui/Divider";
import { type AuthErrorCode, getAuthErrorMessage } from "@/utils/auth/errorCodes";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

type TurnstileApi = {
    render: (
        container: string | HTMLElement,
        options: {
            sitekey: string;
            theme?: "light" | "dark" | "auto";
            language?: string;
            size?: "normal" | "compact" | "flexible";
            action?: string;
            callback?: (token: string) => void;
            "error-callback"?: () => void;
            "expired-callback"?: () => void;
        }
    ) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId: string) => void;
};

function getTurnstile(): TurnstileApi | null {
    if (typeof window === "undefined") return null;
    const api = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    return api ?? null;
}

function getTurnstileLanguage(locale: string): string {
    const normalized = locale.toLowerCase();
    if (normalized === "no" || normalized.startsWith("no-") || normalized === "nb") return "nb";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
    return "auto";
}

export default function AuthForm(): ReactElement {
    const locale = useLocale();
    const t = useTranslations("login");
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const turnstileEnabled = Boolean(turnstileSiteKey);

    const searchParams = useSearchParams();
    const errorCode = searchParams.get("error") as AuthErrorCode | null;
    const errorMessage = getAuthErrorMessage(t, errorCode);
    const resetSent = searchParams.get("reset") === "sent";

    const { mode, isLogin, isSignup, isForgot, switchTo } = useAuthMode();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isScriptReady, setIsScriptReady] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    const { theme, isThemeResolved } = useResolvedTheme();

    const oauthMode = isSignup ? "signup" : "login";
    const handleGithub = useCallback(
        () => startGithubOAuth(locale, "/dashboard", oauthMode),
        [locale, oauthMode]
    );

    const authFormAction = useMemo(() => (isLogin ? login : signup), [isLogin]);
    const turnstileLanguage = useMemo(() => getTurnstileLanguage(locale), [locale]);
    const shouldRenderTurnstile = turnstileEnabled;
    const turnstileAction = isLogin ? "login" : isSignup ? "signup" : "forgot";

    useEffect(() => {
        if (!turnstileEnabled) return;
        if (getTurnstile()) setIsScriptReady(true);
    }, [turnstileEnabled]);

    useEffect(() => {
        if (
            !shouldRenderTurnstile ||
            !isScriptReady ||
            !isThemeResolved ||
            !containerRef.current ||
            !turnstileSiteKey
        ) {
            return;
        }

        const turnstile = getTurnstile();
        if (!turnstile) return;

        if (widgetIdRef.current) {
            turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
        }

        setTurnstileToken("");

        widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: turnstileSiteKey,
            theme,
            language: turnstileLanguage,
            size: "flexible",
            action: turnstileAction,
            callback: (token) => setTurnstileToken(token),
            "error-callback": () => setTurnstileToken(""),
            "expired-callback": () => {
                setTurnstileToken("");
                if (widgetIdRef.current) turnstile.reset(widgetIdRef.current);
            },
        });

        return () => {
            if (widgetIdRef.current) {
                turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [
        isScriptReady,
        shouldRenderTurnstile,
        isThemeResolved,
        turnstileAction,
        turnstileSiteKey,
        theme,
        turnstileLanguage,
    ]);

    return (
        <div className="w-full max-w-sm text-center">
            <Image
                src="/web-app-manifest-192x192.png"
                alt="The Hub"
                width={48}
                height={48}
                className="mx-auto mb-3 h-12 w-12"
                priority
            />
            <h1 className="mb-2 text-4xl font-bold">
                {isLogin ? t("title") : isSignup ? t("registerTitle") : t("forgotPassword")}
            </h1>
            <p className="text-muted mb-4 text-sm">
                {isLogin
                    ? t("subtitleLogin")
                    : isSignup
                      ? t("subtitleSignup")
                      : t("forgotPasswordSupport")}
            </p>

            <ErrorAlert message={errorMessage} />
            <SuccessAlert message={isForgot && resetSent ? t("checkYourEmail") : null} />

            {shouldRenderTurnstile && (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onReady={() => setIsScriptReady(true)}
                />
            )}

            {isForgot ? (
                <form action={requestPasswordReset} className="space-y-4" autoComplete="on">
                    <Field
                        id="email"
                        label={t("email")}
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                    />
                    {shouldRenderTurnstile && (
                        <>
                            <input
                                type="hidden"
                                name="cf-turnstile-response"
                                value={turnstileToken}
                                readOnly
                            />
                            <div ref={containerRef} className="min-h-[65px]" />
                        </>
                    )}
                    <SubmitButton
                        t={t}
                        disabledByTurnstile={shouldRenderTurnstile && !turnstileToken}
                    >
                        {t("sendResetLink")}
                    </SubmitButton>
                </form>
            ) : (
                <form action={authFormAction} className="space-y-4" autoComplete="on">
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

                    {isLogin && (
                        <p className="text-muted text-left text-sm">
                            {t("forgotPasswordInlinePrefix")}{" "}
                            <button
                                type="button"
                                onClick={() => switchTo("forgot")}
                                className="text-primary hover:text-primary-muted cursor-pointer hover:underline"
                            >
                                {t("forgotPasswordInlineLink")}
                            </button>
                        </p>
                    )}

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

                    {shouldRenderTurnstile && (
                        <>
                            <input
                                type="hidden"
                                name="cf-turnstile-response"
                                value={turnstileToken}
                                readOnly
                            />
                            <div ref={containerRef} className="min-h-[65px]" />
                        </>
                    )}

                    <SubmitButton
                        t={t}
                        disabledByTurnstile={shouldRenderTurnstile && !turnstileToken}
                    >
                        {isLogin ? t("login") : t("register")}
                    </SubmitButton>
                </form>
            )}

            {!isForgot && <Divider label={t("or")} />}

            {!isForgot && (
                <button
                    onClick={handleGithub}
                    type="button"
                    className="bg-foreground text-background inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded py-2 hover:opacity-90"
                >
                    <Image
                        src={
                            theme === "dark"
                                ? "/icons/github-mark.svg"
                                : "/icons/github-mark-white.svg"
                        }
                        alt=""
                        aria-hidden="true"
                        width={20}
                        height={20}
                        className="h-5 w-5"
                    />
                    {t("github")}
                </button>
            )}

            {isForgot ? (
                <button
                    type="button"
                    onClick={() => switchTo("login")}
                    className="bg-surface-subtle text-foreground border-border mt-3 w-full cursor-pointer rounded border py-2 hover:opacity-90"
                >
                    {t("backToLogin")}
                </button>
            ) : (
                <p className="text-muted mt-3 text-sm">
                    {isLogin ? t("noAccount") : t("haveAccount")}{" "}
                    <button
                        type="button"
                        onClick={() => switchTo(isLogin ? "signup" : "login")}
                        className="text-primary hover:text-primary-muted cursor-pointer hover:underline"
                    >
                        {isLogin ? t("goToRegister") : t("goToLogin")}
                    </button>
                </p>
            )}
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
                className="bg-background border-border text-foreground focus:border-primary w-full rounded border px-3 py-2 outline-none"
            />
        </div>
    );
}

function SubmitButton({
    children,
    t,
    disabledByTurnstile,
}: {
    children: ReactNode;
    t: (k: string) => string;
    disabledByTurnstile: boolean;
}): ReactElement {
    const { pending } = useFormStatus();
    const disabled = pending || disabledByTurnstile;
    return (
        <button
            type="submit"
            disabled={disabled}
            className="bg-cta hover:bg-cta-muted w-full cursor-pointer rounded py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={pending}
        >
            <span className="inline-flex items-center justify-center gap-2">
                {pending && (
                    <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    />
                )}
                <span>{children}</span>
            </span>
            <span className="sr-only" aria-live="polite">
                {pending ? t("working") : ""}
            </span>
        </button>
    );
}

function ErrorAlert({ message }: { message?: string | null }): ReactElement | null {
    if (!message) return null;
    return <p className="bg-error-subtle text-error mb-4 rounded p-2 text-sm">{message}</p>;
}

function SuccessAlert({ message }: { message?: string | null }): ReactElement | null {
    if (!message) return null;
    return <p className="bg-success-subtle text-success mb-4 rounded p-2 text-sm">{message}</p>;
}
