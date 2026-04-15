import { getTranslations } from "next-intl/server";
import CountdownProviderCard from "@/components/admin/countdown/CountdownProviderCard";
import { fetchDeniedDates, fetchProviderStatus } from "@/lib/admin/countdown.server";
import type { CountdownSettings } from "@/widgets/schema";

const PROVIDERS: CountdownSettings["provider"][] = ["trippel-trumf", "dnb-supertilbud"];

export default async function AdminWidgetsPage() {
    const t = await getTranslations("admin.widgets.countdown");
    const [statuses, denied] = await Promise.all([
        Promise.all(PROVIDERS.map(fetchProviderStatus)),
        Promise.all(PROVIDERS.map(fetchDeniedDates)),
    ]);

    return (
        <div className="space-y-6 p-6">
            <div>
                <h2 className="text-foreground mb-1 text-lg font-semibold">{t("title")}</h2>
                <p className="text-muted text-sm">{t("description")}</p>
            </div>
            <div className="flex flex-wrap gap-4">
                {PROVIDERS.map((id, i) => (
                    <CountdownProviderCard
                        key={id}
                        providerId={id}
                        initialStatus={statuses[i]}
                        initialDenied={denied[i]}
                    />
                ))}
            </div>
        </div>
    );
}
