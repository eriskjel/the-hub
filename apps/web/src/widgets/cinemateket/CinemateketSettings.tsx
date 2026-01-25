import type { UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import { useTranslations } from "next-intl";

/**
 * Cinemateket widget has no settings - it just displays upcoming films.
 */
export default function CinemateketSettings({
    form: _form,
}: {
    form: UseFormReturn<{ kind: "cinemateket"; settings: Record<string, never> }>;
}): ReactElement {
    const t = useTranslations("widgets.cinemateket.settings");
    // No settings needed
    return <div className="text-sm text-neutral-600">{t("description")}</div>;
}
