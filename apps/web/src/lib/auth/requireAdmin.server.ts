import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminFromUser } from "./isAdmin";

export async function requireAdmin(locale?: string) {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect(locale ? `/${locale}/login` : "/login");
    }

    if (!isAdminFromUser(user)) {
        redirect(locale ? `/${locale}/dashboard?denied=admin` : "/dashboard?denied=admin");
    }

    return { user };
}
