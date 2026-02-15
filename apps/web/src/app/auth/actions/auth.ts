"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { z } from "zod";
import { mapSupabasePasswordResetError, mapSupabaseSignUpError } from "@/utils/auth/mapErrors";
import { getSafeOrigin } from "@/utils/auth/getSafeOrigin";

type TurnstileVerifyResult = {
    success: boolean;
    action?: string;
    "error-codes"?: string[];
};

function getTurnstileRedirectCode(result: TurnstileVerifyResult): string {
    if (result["error-codes"]?.includes("missing-input-response")) {
        return "verification-required";
    }
    if (result["error-codes"]?.includes("timeout-or-duplicate")) {
        return "verification-expired";
    }
    return "verification-failed";
}

async function verifyTurnstileToken(
    token: string,
    expectedAction: "login" | "signup" | "forgot"
): Promise<TurnstileVerifyResult> {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    const isProduction = process.env.NODE_ENV === "production";
    const turnstileConfigured = Boolean(siteKey && secret);

    if (!turnstileConfigured) {
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
        if (!response.ok) {
            console.error("Turnstile verification HTTP error", {
                status: response.status,
                expectedAction,
            });
            return { success: false, "error-codes": ["internal-error"] };
        }

        const result = (await response.json()) as TurnstileVerifyResult;
        if (result.success && result.action && result.action !== expectedAction) {
            return { success: false, "error-codes": ["invalid-input-response"] };
        }
        return result;
    } catch (error) {
        console.error("Turnstile token verification failed", {
            error,
            expectedAction,
        });
        return { success: false, "error-codes": ["internal-error"] };
    }
}

export async function login(formData: FormData) {
    const locale = await resolveLocale();

    const supabase = await createClient();

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const turnstileResult = await verifyTurnstileToken(turnstileToken, "login");

    if (!turnstileResult.success) {
        const code = getTurnstileRedirectCode(turnstileResult);
        redirect(`/${locale}/login?error=${code}`);
    }

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

const updatePasswordSchema = z
    .object({
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
    const turnstileResult = await verifyTurnstileToken(turnstileToken, "signup");

    if (!turnstileResult.success) {
        const code = getTurnstileRedirectCode(turnstileResult);
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

export async function requestPasswordReset(formData: FormData) {
    const locale = await resolveLocale();
    const supabase = await createClient();
    const email = String(formData.get("email") || "").trim();
    const parsedEmail = z.string().email("invalid-email").safeParse(email);
    if (!parsedEmail.success) {
        redirect(`/${locale}/login?mode=forgot&error=invalid-email`);
    }

    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const turnstileResult = await verifyTurnstileToken(turnstileToken, "forgot");
    if (!turnstileResult.success) {
        const code = getTurnstileRedirectCode(turnstileResult);
        redirect(`/${locale}/login?mode=forgot&error=${code}`);
    }

    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
    const proto = headersList.get("x-forwarded-proto") ?? "https";
    let origin: string;
    try {
        origin = getSafeOrigin(new URL(`${proto}://${host}`), host);
    } catch {
        redirect(`/${locale}/login?mode=forgot&error=password-reset-failed`);
    }

    const redirectTo = `${origin}/auth/callback?locale=${locale}&next=/${locale}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
        const code = mapSupabasePasswordResetError(error);
        redirect(`/${locale}/login?mode=forgot&error=${encodeURIComponent(code)}`);
    }
    redirect(`/${locale}/login?mode=forgot&reset=sent`);
}

export async function updatePassword(formData: FormData) {
    const locale = await resolveLocale();
    const supabase = await createClient();

    const data = {
        password: String(formData.get("password") || ""),
        confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    const parsed = updatePasswordSchema.safeParse(data);
    if (!parsed.success) {
        const code = parsed.error.errors[0]?.message ?? "password-update-failed";
        redirect(`/${locale}/reset-password?error=${encodeURIComponent(code)}`);
    }

    const { error } = await supabase.auth.updateUser({
        password: data.password,
    });

    if (error) {
        redirect(`/${locale}/reset-password?error=password-update-failed`);
    }

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
