import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Profile } from "@/types/database";
import { getNameFromProfile } from "@/utils/nameFromProfile";
import WidgetsGrid from "@/components/widgets/WidgetsGrid";
import { getWidgetsSafe } from "@/lib/widgets/getWidgets.server";

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

    const widgetsResult = await getWidgetsSafe();

    const t = await getTranslations("dashboard");

    return (
        <div className="min-h-full text-white">
            <header className="py-8 text-center">
                <h1 className="mb-2 text-5xl font-bold">The Hub</h1>
                <p className="text-lg">{t("welcome", { name })}</p>
            </header>
            <main className="mx-auto max-w-6xl p-4">
                <WidgetsGrid widgetsResult={widgetsResult} />
            </main>
        </div>
    );
}
