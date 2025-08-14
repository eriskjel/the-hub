"use client";

import { login, signup } from "@/app/auth/actions/auth";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Sender…" : children}
    </button>
  );
}

export default function LoginForm() {
  const sp = useSearchParams();
  const error = sp.get("error");

  return (
    <div className="w-full max-w-sm text-center">
      <h1 className="mb-4 text-4xl font-bold">Logg inn</h1>

      {error && (
        <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">
          {error === "invalid-credentials" && "Feil e-post eller passord."}
          {error === "signup-failed" && "Kunne ikke registrere bruker."}
          {error === "confirm-failed" && "Bekreftelseslenken er ugyldig eller utløpt."}
          {!["invalid-credentials", "signup-failed", "confirm-failed"].includes(error) &&
            "Noe gikk galt."}
        </p>
      )}

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
            className="flex-1 rounded bg-gray-900 py-2 text-white hover:bg-gray-800"
          >
            Registrer
          </button>
        </div>
      </form>
    </div>
  );
}
