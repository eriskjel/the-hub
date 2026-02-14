"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";
import { z } from "zod";
import { mapSupabaseSignUpError } from "@/utils/auth/mapErrors";

export async function login(formData: FormData) {
    const locale = await resolveLocale();

    const supabase = await createClient();

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

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
    if (!email) {
        return { error: "invalid-email" as const };
    }
    const headersList = await headers();
    const host = headersList.get("host") ?? "";
    const proto =
        headersList.get("x-forwarded-proto") ??
        (process.env.NODE_ENV === "development" ? "http" : "https");
    const origin = `${proto}://${host}`;
    const redirectTo = `${origin}/auth/confirm?next=/${locale}/dashboard`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
        return { error: "rate-limited" as const };
    }
    return { success: true };
}

export async function logout() {
    const locale = await resolveLocale();

    const supabase = await createClient();
    await supabase.auth.signOut();

    revalidatePath(`/${locale}`, "layout");
    redirect(`/${locale}/login`);
}
