"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  // TODO: add real validation (zod/yup) & friendly error display
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // optional: append query params to show an error on the page
    redirect("/login?error=invalid-credentials");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect("/login?error=signup-failed");
  }
  revalidatePath("/", "layout");
  redirect("/");
}
