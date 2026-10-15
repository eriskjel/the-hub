import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/requireAdmin.server";
import { Link } from "@/i18n/navigation";
import { getUserAdmin } from "@/lib/admin/fetchUser.server";
import { getMediaMember } from "@/lib/admin/mediaMember.server";
import { parseUsersQuery, usersSearchParams } from "@/lib/admin/users";
import { pickDisplayName } from "@/lib/auth/pickDisplayName";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { AdminPage } from "@/components/admin/AdminPage";
import MediaAccessCard from "@/components/admin/users/MediaAccessCard";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; userId: string }>;
    searchParams: Promise<{
        page?: string | string[];
        per?: string | string[];
        q?: string | string[];
    }>;
}) {
    const { locale, userId } = await params;
    await requireAdmin(locale);
    const t = await getTranslations({ locale, namespace: "admin.users.detail" });
    const user = await getUserAdmin(userId);
    if (!user) return notFound();
    const mediaMember = await getMediaMember(user.id);
    const back = `/admin/users?${usersSearchParams(parseUsersQuery(await searchParams))}`;
    const formatDate = (date: string) =>
        new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Europe/Oslo",
        }).format(new Date(date));

    return (
        <AdminPage
            title={pickDisplayName(user)}
            description={user.auth.email}
            eyebrow={
                <Link
                    href={back}
                    className="hover:text-foreground inline-flex items-center gap-2 rounded py-1"
                >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    {t("back")}
                </Link>
            }
            actions={<RoleBadge role={user.auth.effective_role} />}
        >
            <div className="grid items-start gap-6 xl:grid-cols-2">
                <section className="border-border bg-surface rounded-2xl border p-6">
                    <h2 className="text-foreground mb-5 font-semibold">
                        {t("cards.account.title")}
                    </h2>
                    <dl className="divide-border divide-y text-sm">
                        <div className="space-y-2 pb-4">
                            <dt className="text-muted">{t("cards.account.id")}</dt>
                            <dd className="text-foreground font-mono text-xs break-all select-all">
                                {user.id}
                            </dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 py-4">
                            <dt className="text-muted">{t("cards.account.created")}</dt>
                            <dd>{formatDate(user.created_at)}</dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 pt-4">
                            <dt className="text-muted">{t("cards.account.last_login")}</dt>
                            <dd>
                                {user.auth.last_sign_in_at
                                    ? formatDate(user.auth.last_sign_in_at)
                                    : t("never")}
                            </dd>
                        </div>
                    </dl>
                </section>
                <MediaAccessCard
                    key={user.id}
                    userId={user.id}
                    member={mediaMember}
                    targetIsAdmin={user.auth.effective_role === "admin"}
                />
            </div>
            <details className="border-border bg-surface rounded-2xl border p-5">
                <summary className="text-muted cursor-pointer text-sm font-medium">
                    {t("cards.meta.title")}
                </summary>
                <pre className="text-muted mt-4 overflow-auto text-xs break-words whitespace-pre-wrap">
                    {JSON.stringify(user.auth.raw_app_meta_data, null, 2)}
                </pre>
            </details>
        </AdminPage>
    );
}
