import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { resolveLocale } from "@/i18n/resolve-locale";

export default async function AuthCodeErrorPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string; locale?: string }>;
}) {
    const { reason, locale: qsLocale } = await searchParams;

    // Prefer query param from the handlers; fallback to resolver
    const locale = qsLocale || (await resolveLocale());
    setRequestLocale(locale);

    const t = await getTranslations("auth");
    const reasonText = reason ?? t("unknown_reason");

    // todo: make this more robust
    const reasonForUi =
        process.env.NODE_ENV === "development" ? reasonText.slice(0, 200) : t("unknown_reason");

    return (
        <main className="flex min-h-dvh items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
                <h1 className="mb-2 text-2xl font-semibold">{t("loginFailed")}</h1>
                <p className="mb-4 text-sm text-neutral-600">
                    {t("couldNotAuthenticate")} ({reasonForUi})
                </p>
                <Link
                    href={`/${locale}/login`}
                    className="inline-block rounded-xl border px-4 py-2"
                >
                    {t("goToLogin")}
                </Link>
            </div>
        </main>
    );
}
