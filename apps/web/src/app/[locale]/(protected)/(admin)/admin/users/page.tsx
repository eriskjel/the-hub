import UsersTable from "@/components/admin/UsersTable";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
    const { users, perPage } = await listUsersAdmin({ page: 1, perPage: 20 });

    const t = await getTranslations("admin.users");

    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
            <UsersTable users={users} pageSize={perPage} />
        </div>
    );
}
