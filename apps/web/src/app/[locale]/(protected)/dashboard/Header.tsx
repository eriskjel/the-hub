import { getCurrentUserAndProfile } from "@/lib/auth/getProfile.server";
import { getTranslations } from "next-intl/server";
import { ReactElement } from "react";
import { pickDisplayName } from "@/lib/auth/pickDisplayName";

export async function Header({
    userPromise,
    locale,
}: {
    userPromise: ReturnType<typeof getCurrentUserAndProfile>;
    locale: string;
}) {
    const [{ user, profile }, t] = await Promise.all([
        userPromise,
        getTranslations({ locale, namespace: "dashboard" }),
    ]);
    const name = pickDisplayName(profile, user);

    return (
        <div className="mx-auto max-w-6xl p-4">
            <header className="py-8 text-center">
                <h1 className="mb-2 text-5xl font-bold text-white">The Hub</h1>
                <p className="text-lg text-white">{t("welcome", { name })}</p>
            </header>
        </div>
    );
}

export function HeaderSkeleton(): ReactElement {
    return (
        <div className="mx-auto max-w-6xl p-4">
            <header className="py-8 text-center">
                <h1 className="relative mb-2 text-5xl font-bold text-transparent select-none">
                    The Hub
                    <span
                        aria-hidden
                        className="absolute inset-0 animate-pulse rounded bg-white/10"
                    />
                </h1>
                <p className="relative mx-auto text-lg text-transparent select-none">
                    Welcome, User
                    <span
                        aria-hidden
                        className="absolute inset-0 mx-auto h-full w-[12rem] animate-pulse rounded bg-white/10"
                    />
                </p>
            </header>
        </div>
    );
}
