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
        <main className="flex min-h-dvh items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
                <h1 className="mb-2 text-2xl font-semibold">{t("loginFailed")}</h1>
                <p className="mb-4 text-sm text-neutral-600">
                    {t("couldNotAuthenticate")} - ({reason})
                </p>
                <Link href="/no/login" className="inline-block rounded-xl border px-4 py-2">
                    {t("goToLogin")}
                </Link>
            </div>
        </main>
    );
}
