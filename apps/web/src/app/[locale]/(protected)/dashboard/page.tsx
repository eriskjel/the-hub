import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Profile } from "@/types/database";
import { getNameFromProfile } from "@/utils/nameFromProfile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: profile, error: profileError } = user
        ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
        : { data: null, error: null };

    if (profileError) {
        console.warn("Failed to fetch profile:", profileError.message);
    }

    const name = getNameFromProfile(profile) ?? user?.email?.split("@")[0] ?? "User";

    const t = await getTranslations("dashboard");
    return (
        <div className="flex h-full items-center justify-center text-center text-white">
            <div>
                <h1 className="mb-4 text-5xl font-bold">The Hub</h1>
                <p className="text-lg">{t("welcome", { name: name })}</p>
            </div>
        </div>
    );
}
