import { getTranslations } from "next-intl/server";
import { getNameFromProfile } from "@/utils/nameFromProfile";
import WidgetsGrid from "@/components/widgets/WidgetsGrid";
import { getWidgetsSafe, WidgetsResult } from "@/lib/widgets/getWidgets.server";
import { getCurrentUserAndProfile } from "@/lib/auth/getProfile.server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const { user, profile, error } = await getCurrentUserAndProfile();
    if (error) console.warn("Failed to fetch profile:", error);

    const name: string = getNameFromProfile(profile) ?? user?.email?.split("@")[0] ?? "User";
    const userId: string | null = user?.id ?? null;

    const widgetsResult: WidgetsResult = await getWidgetsSafe(userId);

    const t = await getTranslations("dashboard");

    return (
        <div className="min-h-full text-white">
            <header className="py-8 text-center">
                <h1 className="mb-2 text-5xl font-bold">The Hub</h1>
                <p className="text-lg">{t("welcome", { name })}</p>
            </header>
            <main className="mx-auto max-w-6xl p-4">
                <WidgetsGrid widgetsResult={widgetsResult} userId={userId} />
            </main>
        </div>
    );
}
