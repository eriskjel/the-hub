import { ReactElement, Suspense } from "react";
import { getCurrentUserAndProfile } from "@/lib/auth/getProfile.server";
import { getDashboardWidgets, type WidgetsResult } from "@/lib/widgets/getWidgets.server";
import WidgetsGrid from "@/components/widgets/WidgetsGrid";
import CreateWidgetButton from "@/components/widgets/CreateWidgetButton";
import { Header, HeaderSkeleton } from "./Header";
import WidgetCardSkeleton from "@/components/widgets/WidgetCardSkeleton";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const userPromise = getCurrentUserAndProfile();
    const widgetsPromise: Promise<WidgetsResult> = getDashboardWidgets(userPromise);

    return (
        <div className="min-h-full">
            <Suspense fallback={<HeaderSkeleton />}>
                <Header userPromise={userPromise} locale={locale} />
            </Suspense>

            <main className="mx-auto max-w-6xl p-4">
                <div className="mb-4 flex items-center justify-center">
                    <Suspense fallback={<CreateWidgetButton className="invisible" />}>
                        <ActionsBar widgetsPromise={widgetsPromise} />
                    </Suspense>
                </div>

                <Suspense fallback={<DashboardSkeleton />}>
                    <WidgetsSection userPromise={userPromise} widgetsPromise={widgetsPromise} />
                </Suspense>
            </main>
        </div>
    );
}

async function WidgetsSection({
    userPromise,
    widgetsPromise,
}: {
    userPromise: ReturnType<typeof getCurrentUserAndProfile>;
    widgetsPromise: Promise<WidgetsResult>;
}) {
    const [{ user }, widgetsResult] = await Promise.all([userPromise, widgetsPromise]);
    const userId = user?.id ?? null;
    return <WidgetsGrid widgetsResult={widgetsResult} userId={userId} />;
}

async function ActionsBar({ widgetsPromise }: { widgetsPromise: Promise<WidgetsResult> }) {
    const result = await widgetsPromise;
    if (result.widgets.length === 0 && result.offline) return <div className="h-10" />;
    return <CreateWidgetButton />;
}

function DashboardSkeleton(): ReactElement {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <WidgetCardSkeleton key={i} />
            ))}
        </div>
    );
}
