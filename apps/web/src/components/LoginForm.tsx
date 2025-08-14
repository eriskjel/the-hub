"use client";

import { login, signup } from "@/app/auth/actions/auth";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ReactElement, ReactNode, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { getBaseUrl } from "@/utils/url";
import { useLocale, useTranslations } from "next-intl";

const ERROR_KEY_BY_CODE = {
  "invalid-credentials": "invalidCredentials",
  "signup-failed": "signupFailed",
  "confirm-failed": "confirmFailed",
} as const;

type ErrorCode = keyof typeof ERROR_KEY_BY_CODE;
type ErrorKey = (typeof ERROR_KEY_BY_CODE)[ErrorCode] | "generic";

export default function LoginForm(): ReactElement {
  const locale = useLocale();
  const t = useTranslations("login");

  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") as ErrorCode | null;
  const errorKey: ErrorKey = (errorCode && ERROR_KEY_BY_CODE[errorCode]) ?? "generic";
  const errorMessage =
    // Only show if there *is* an error param; otherwise no alert
    errorCode ? t(`errors.${errorKey}`) : null;
  const supabase = useMemo(() => createClient(), []);

  const handleGithub = useCallback(async () => {
    const base: string = getBaseUrl();
    const next = `/${locale}/dashboard`;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${base}auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`,
      },
    });
  }, [supabase]);

  return (
    <div className="w-full max-w-sm text-center">
      <h1 className="mb-4 text-4xl font-bold">{t("title")}</h1>

      <ErrorAlert message={errorMessage} />

      <form action={login} className="space-y-4" autoComplete="on">
        <div className="space-y-1 text-left">
          <label htmlFor="email" className="block text-sm font-medium">
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1 text-left">
          <label htmlFor="password" className="block text-sm font-medium">
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          <SubmitButton t={t}>{t("login")}</SubmitButton>
          <button
            formAction={signup}
            className="flex-1 cursor-pointer rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
          >
            {t("register")}
          </button>
        </div>
      </form>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">{t("or")}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* GitHub login */}
      <button
        onClick={handleGithub}
        className="w-full cursor-pointer rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
      >
        {t("github")}
      </button>
    </div>
  );
}

function SubmitButton({ children, t }: { children: ReactNode; t: (key: string) => string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 cursor-pointer rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? t("working") : children}
    </button>
  );
}

function ErrorAlert({ message }: { message?: string | null }): ReactElement | null {
  if (!message) return null;
  return <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{message}</p>;
}
