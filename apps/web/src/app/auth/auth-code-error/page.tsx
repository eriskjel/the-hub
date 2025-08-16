import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AuthCodeErrorPage({
    searchParams,
}: {
    searchParams: { reason?: string };
}) {
    const t = await getTranslations("auth");

    const reason = searchParams?.reason ?? t("unknown_reason");

    return (
        <main className="min-h-dvh flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border p-6 bg-white">
                <h1 className="text-2xl font-semibold mb-2">{t("loginFailed")}</h1>
                <p className="text-sm text-neutral-600 mb-4">
                    {t("couldNotAuthenticate")} - ({reason})
                </p>
                <Link href="/no/login" className="inline-block rounded-xl border px-4 py-2">
                    {t("goToLogin")}
                </Link>
            </div>
        </main>
    );
}
