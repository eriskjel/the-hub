import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const profile: Profile | null = user
        ? ((await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()).data ??
          null)
        : null;

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

function getNameFromProfile(profile: Profile | null) {
    return profile?.full_name ?? profile?.username ?? null;
}
