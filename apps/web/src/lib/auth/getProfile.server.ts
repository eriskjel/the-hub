import { createClient } from "@/utils/supabase/server";
import type { Profile } from "@/types/database";

export async function getCurrentUserAndProfile(): Promise<{
    user: { id: string; email?: string | null } | null;
    profile: Profile | null;
    error?: string;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { user: null, profile: null };

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single<Profile>();

    return { user: { id: user.id, email: user.email }, profile, error: error?.message };
}
