import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { Link } from "@/i18n/navigation";
import { getUserAdmin } from "@/lib/admin/fetchUser.server";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
    params,
}: {
    params: Promise<{ locale: string; userId: string }>;
}) {
    const { locale, userId } = await params;
    await requireAdmin(locale);

    const t = await getTranslations({ locale, namespace: "admin.users.detail" });

    const user = await getUserAdmin(userId);
    if (!user) return notFound();

    return (
        <div className="space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        {user.full_name ?? user.username ?? user.auth.email ?? user.id}
                    </h1>
                    <p className="text-sm text-gray-600">{user.auth.email}</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/admin/users"
                        className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                        {t("back")}
                    </Link>
                    <Link
                        href={`/admin/users/${user.id}/edit`}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                        {t("edit")}
                    </Link>
                </div>
            </div>

            {/* Overview cards */}
            <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-white p-4">
                    <h2 className="mb-2 font-semibold">{t("cards.account.title")}</h2>
                    <dl className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-600">{t("cards.account.id")}</dt>
                            <dd className="font-mono">{user.id}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-600">{t("cards.account.role")}</dt>
                            <dd>{user.auth.effective_role}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-600">{t("cards.account.created")}</dt>
                            <dd>{new Date(user.created_at).toLocaleString()}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-600">{t("cards.account.last_login")}</dt>
                            <dd>
                                {user.auth.last_sign_in_at
                                    ? new Date(user.auth.last_sign_in_at).toLocaleString()
                                    : "—"}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-lg border bg-white p-4">
                    <h2 className="mb-2 font-semibold">{t("cards.meta.title")}</h2>
                    <pre className="text-xs break-words whitespace-pre-wrap text-gray-700">
                        {JSON.stringify(user.auth.raw_app_meta_data, null, 2)}
                    </pre>
                </div>
            </section>
        </div>
    );
}
