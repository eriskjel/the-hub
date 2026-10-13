import { getTranslations } from "next-intl/server";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { getMediaMembers } from "@/lib/admin/mediaMember.server";
import UsersTable from "@/components/admin/users/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
    searchParams,
    params,
}: {
    searchParams: Promise<{ page?: string; per?: string }>;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const sp = await searchParams;
    const page = Math.max(1, Number(sp?.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(sp?.per ?? 5)));

    const { users, total } = await listUsersAdmin({ page, perPage });
    const mediaMembers = await getMediaMembers(users.map((u) => u.id));
    const t = await getTranslations({ locale, namespace: "admin.users" });

    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
            <UsersTable
                users={users}
                mediaMembers={mediaMembers}
                page={page}
                pageSize={perPage}
                total={total}
            />
        </div>
    );
}
