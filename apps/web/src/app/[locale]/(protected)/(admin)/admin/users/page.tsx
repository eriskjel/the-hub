import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/AdminPage";
import UsersTable from "@/components/admin/users/UsersTable";
import UsersTableSkeleton from "@/components/admin/users/UsersTableSkeleton";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { parseUsersQuery, type AdminUsersQuery } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
    searchParams,
    params,
}: {
    searchParams: Promise<{
        page?: string | string[];
        per?: string | string[];
        q?: string | string[];
    }>;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const query = parseUsersQuery(await searchParams);
    const t = await getTranslations({ locale, namespace: "admin.users" });
    return (
        <AdminPage title={t("title")} description={t("description")}>
            <Suspense fallback={<UsersTableSkeleton label={t("loading")} />}>
                <UsersData query={query} />
            </Suspense>
        </AdminPage>
    );
}

async function UsersData({ query }: { query: AdminUsersQuery }) {
    const initialData = await listUsersAdmin(query);
    return <UsersTable key={initialData.viewerId} initialData={initialData} initialQuery={query} />;
}
