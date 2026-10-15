"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AdminPage } from "@/components/admin/AdminPage";

export default function AdminError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("admin");
    return (
        <AdminPage title={t("error.title")} description={t("error.description")}>
            <Button type="button" variant="primary" onClick={reset}>
                {t("error.retry")}
            </Button>
        </AdminPage>
    );
}
