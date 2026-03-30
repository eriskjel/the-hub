import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { Link } from "@/i18n/navigation";
import { getUserAdmin } from "@/lib/admin/fetchUser.server";
import { RoleBadge } from "@/components/admin/RoleBadge";

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
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-foreground text-2xl font-bold">
                        {user.full_name ?? user.username ?? user.auth.email ?? user.id}
                    </h1>
                    <p className="text-muted text-sm">{user.auth.email}</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/admin/users"
                        locale={locale}
                        className="border-border bg-surface text-muted hover:bg-surface-light hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                        {t("back")}
                    </Link>
                    <Link
                        href={`/admin/users/${user.id}/edit`}
                        locale={locale}
                        className="bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                        {t("edit")}
                    </Link>
                </div>
            </div>

            <section className="grid gap-4 md:grid-cols-2">
                <div className="border-border bg-surface rounded-lg border p-4">
                    <h2 className="text-foreground mb-3 font-semibold">
                        {t("cards.account.title")}
                    </h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted">{t("cards.account.id")}</dt>
                            <dd className="text-foreground truncate font-mono">{user.id}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted">{t("cards.account.role")}</dt>
                            <dd>
                                <RoleBadge role={user.auth.effective_role} />
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted">{t("cards.account.created")}</dt>
                            <dd className="text-foreground">
                                {new Date(user.created_at).toLocaleString()}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted">{t("cards.account.last_login")}</dt>
                            <dd className="text-foreground">
                                {user.auth.last_sign_in_at
                                    ? new Date(user.auth.last_sign_in_at).toLocaleString()
                                    : "—"}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="border-border bg-surface rounded-lg border p-4">
                    <h2 className="text-foreground mb-3 font-semibold">{t("cards.meta.title")}</h2>
                    <pre className="text-muted overflow-auto text-xs break-words whitespace-pre-wrap">
                        {JSON.stringify(user.auth.raw_app_meta_data, null, 2)}
                    </pre>
                </div>
            </section>
        </div>
    );
}
