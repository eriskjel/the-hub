import { getTranslations } from "next-intl/server";
import CountdownProviderCard from "@/components/admin/countdown/CountdownProviderCard";
import { fetchDeniedDates, fetchProviderStatus } from "@/lib/admin/countdown.server";
import type { CountdownSettings } from "@/widgets/schema";
import { AdminPage } from "@/components/admin/AdminPage";

const PROVIDERS: CountdownSettings["provider"][] = ["trippel-trumf", "dnb-supertilbud"];

export default async function AdminWidgetsPage() {
    const t = await getTranslations("admin.widgets.countdown");
    const [statuses, denied] = await Promise.all([
        Promise.all(PROVIDERS.map(fetchProviderStatus)),
        Promise.all(PROVIDERS.map(fetchDeniedDates)),
    ]);

    return (
        <AdminPage title={t("title")} description={t("description")}>
            <div className="grid gap-5 xl:grid-cols-2">
                {PROVIDERS.map((id, i) => (
                    <CountdownProviderCard
                        key={id}
                        providerId={id}
                        initialStatus={statuses[i]}
                        initialDenied={denied[i]}
                    />
                ))}
            </div>
        </AdminPage>
    );
}
