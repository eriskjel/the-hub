"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AdminPage } from "@/components/admin/AdminPage";

export default function AdminError({
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    const t = useTranslations("admin");
    return (
        <AdminPage title={t("error.title")} description={t("error.description")}>
            <Button type="button" variant="primary" onClick={retry}>
                {t("error.retry")}
            </Button>
        </AdminPage>
    );
}
