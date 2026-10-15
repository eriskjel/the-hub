import Form from "next/form";
import { Link } from "@/i18n/navigation";
import { FieldText } from "@/components/ui/Fields";
import { Button } from "@/components/ui/Button";
import { getTranslations } from "next-intl/server";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { getMediaMembers } from "@/lib/admin/mediaMember.server";
import UsersTable from "@/components/admin/users/UsersTable";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;

/** A repeated query parameter arrives as an array; use its first value. */
const firstValue = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function AdminUsersPage({
    searchParams,
    params,
}: {
    searchParams: Promise<{ page?: QueryValue; per?: QueryValue; q?: QueryValue }>;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const sp = await searchParams;
    const requestedPage = Number(firstValue(sp.page) ?? 1);
    const requestedPerPage = Number(firstValue(sp.per) ?? 5);
    const q = (firstValue(sp.q) ?? "").trim().slice(0, 100);

    const { users, total, page, perPage } = await listUsersAdmin({
        page: requestedPage,
        perPage: requestedPerPage,
        q,
    });
    const mediaMembers = await getMediaMembers(users.map((u) => u.id));
    const t = await getTranslations({ locale, namespace: "admin.users" });

    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
            <Form
                action={`/${locale}/admin/users`}
                key={q}
                className="mb-6 flex flex-wrap items-end gap-3"
            >
                <div className="min-w-56 flex-1">
                    <FieldText
                        name="q"
                        type="search"
                        label={t("search.label")}
                        placeholder={t("search.placeholder")}
                        defaultValue={q}
                        maxLength={100}
                    />
                </div>
                <input type="hidden" name="per" value={String(perPage)} />
                <Button type="submit">{t("search.submit")}</Button>
                {q && (
                    <Link
                        href={{ pathname: "/admin/users", query: { per: String(perPage) } }}
                        className="text-muted px-3 py-2 text-sm underline"
                    >
                        {t("search.clear")}
                    </Link>
                )}
            </Form>
            {total === 0 && (
                <p role="status" className="text-muted mb-4">
                    {t("empty")}
                </p>
            )}
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
