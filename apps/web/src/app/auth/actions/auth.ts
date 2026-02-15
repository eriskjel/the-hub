"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { z } from "zod";
import { mapSupabaseSignUpError } from "@/utils/auth/mapErrors";

type TurnstileVerifyResult = {
    success: boolean;
    action?: string;
    "error-codes"?: string[];
};

async function verifyTurnstileToken(token: string): Promise<TurnstileVerifyResult> {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    const isProduction = process.env.NODE_ENV === "production";
    const turnstileConfigured = Boolean(siteKey && secret);

    if (!turnstileConfigured) {
        // Hardened behavior:
        // - production fails closed if Turnstile is not fully configured.
        // - local/test can run without Turnstile env vars.
        if (isProduction) {
            return { success: false, "error-codes": ["missing-input-secret"] };
        }
        return { success: true };
    }

    if (!token) {
        return { success: false, "error-codes": ["missing-input-response"] };
    }

    const body = new URLSearchParams({
        secret: secret as string,
        response: token,
    });

    try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            cache: "no-store",
        });

        return (await response.json()) as TurnstileVerifyResult;
    } catch {
        return { success: false, "error-codes": ["internal-error"] };
    }
}

export async function login(formData: FormData) {
    const locale = await resolveLocale();

    const supabase = await createClient();

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const turnstileResult = await verifyTurnstileToken(turnstileToken);

    if (!turnstileResult.success) {
        const code =
            turnstileResult["error-codes"]?.includes("missing-input-response") ||
            turnstileResult["error-codes"]?.includes("timeout-or-duplicate")
                ? "verification-required"
                : "verification-failed";
        redirect(`/${locale}/login?error=${code}`);
    }

    // TODO: add real validation (zod/yup) & friendly error display
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        redirect(`/${locale}/login?error=invalid-credentials`);
    }

    await ensureDefaultRole();

    revalidatePath(`/${locale}`, "layout");
    redirect(`/${locale}/dashboard`);
}

const signupSchema = z
    .object({
        name: z.string().min(1, "name-required"),
        email: z.string().email("invalid-email"),
        password: z.string().min(6, "password-too-short"),
        confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
        message: "password-mismatch",
        path: ["confirmPassword"],
    });
export async function signup(formData: FormData) {
    const locale = await resolveLocale();
    const supabase = await createClient();
    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const turnstileResult = await verifyTurnstileToken(turnstileToken);

    if (!turnstileResult.success) {
        const code =
            turnstileResult["error-codes"]?.includes("missing-input-response") ||
            turnstileResult["error-codes"]?.includes("timeout-or-duplicate")
                ? "verification-required"
                : "verification-failed";
        return redirect(`/${locale}/login?mode=signup&error=${code}`);
    }

    const data = {
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
        const code = parsed.error.errors[0]?.message ?? "signup-invalid";
        return redirect(`/${locale}/login?mode=signup&error=${encodeURIComponent(code)}`);
    }

    const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, full_name: data.name } },
    });

    if (error) {
        const code = mapSupabaseSignUpError(error);
        return redirect(`/${locale}/login?mode=signup&error=${encodeURIComponent(code)}`);
    }

    await ensureDefaultRole();
    revalidatePath(`/${locale}`, "layout");
    redirect(`/${locale}/dashboard`);
}

export async function logout() {
    const locale = await resolveLocale();

    const supabase = await createClient();
    await supabase.auth.signOut();

    revalidatePath(`/${locale}`, "layout");
    redirect(`/${locale}/login`);
}
