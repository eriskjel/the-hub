"use client";

import { login, signup } from "@/app/auth/actions/auth";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ReactElement, ReactNode, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { getBaseUrl } from "@/utils/url";

const ERROR_MESSAGES = {
  "invalid-credentials": "Feil e-post eller passord.",
  "signup-failed": "Kunne ikke registrere bruker.",
  "confirm-failed": "Bekreftelseslenken er ugyldig eller utløpt.",
} as const;

type AuthErrorCode = keyof typeof ERROR_MESSAGES;

const DEFAULT_ERROR_MESSAGE = "Noe gikk galt.";

function getErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return code in ERROR_MESSAGES ? ERROR_MESSAGES[code as AuthErrorCode] : DEFAULT_ERROR_MESSAGE;
}

export default function LoginForm(): ReactElement {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = getErrorMessage(errorCode);
  const supabase = useMemo(() => createClient(), []);

  const handleGithub = useCallback(async () => {
    const base: string = getBaseUrl();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${base}auth/callback?next=/`,
        // Optional: request extra scopes
        // scopes: "read:user user:email",
      },
    });
  }, [supabase]);

  return (
    <div className="w-full max-w-sm text-center">
      <h1 className="mb-4 text-4xl font-bold">Logg inn</h1>

      <ErrorAlert message={errorMessage} />

      <form action={login} className="space-y-4" autoComplete="on">
        <div className="space-y-1 text-left">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
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
            Passord
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
          <SubmitButton>Logg inn</SubmitButton>
          <button
            formAction={signup}
            className="flex-1 cursor-pointer rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
          >
            Registrer
          </button>
        </div>
      </form>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">eller</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* GitHub login */}
      <button
        onClick={handleGithub}
        className="w-full cursor-pointer rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
      >
        Fortsett med GitHub
      </button>
    </div>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 cursor-pointer rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Sender…" : children}
    </button>
  );
}

function ErrorAlert({ message }: { message?: string | null }): ReactElement | null {
  if (!message) return null;
  return <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{message}</p>;
}
