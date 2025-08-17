"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveLocale } from "@/i18n/resolve-locale";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRole";

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

export async function signup(formData: FormData) {
    const locale = await resolveLocale();

    const supabase = await createClient();

    const fullName = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!fullName || !email || !password) {
        redirect(`/${locale}/login?error=signup-failed`);
    }
    if (password !== confirmPassword) {
        redirect(`/${locale}/login?error=confirm-failed`);
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: fullName } },
    });

    if (error) {
        redirect(`/${locale}/login?error=signup-failed`);
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
