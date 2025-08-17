import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Profile } from "@/types/database";
import { getNameFromProfile } from "@/utils/nameFromProfile";
import { AnyWidget } from "@/types/widgets/types";
import { getWidgets } from "@/lib/widgets/getWidgets.server";
import WidgetCard from "@/components/widgets/WidgetCard";
import { ReactElement } from "react";

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

    const widgets: AnyWidget[] = await getWidgets();

    const t = await getTranslations("dashboard");

    return (
        <div className="min-h-full text-white">
            <header className="py-8 text-center">
                <h1 className="mb-2 text-5xl font-bold">The Hub</h1>
                <p className="text-lg">{t("welcome", { name })}</p>
            </header>
            <main className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                <WidgetsGrid widgets={widgets} />
            </main>
        </div>
    );
}

function WidgetsGrid({ widgets }: { widgets: AnyWidget[] }): ReactElement {
    return (
        <>
            {widgets.map((w) => (
                <div key={w.instanceId} className="rounded-2xl bg-neutral-900 p-2">
                    <div className="px-2 py-1 text-sm text-neutral-400">{w.title}</div>
                    <WidgetCard widget={w} />
                </div>
            ))}
        </>
    );
}
