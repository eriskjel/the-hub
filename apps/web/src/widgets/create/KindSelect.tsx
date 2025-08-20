"use client";

import type { ReactElement } from "react";
import { FieldSelect } from "@/components/ui/Fields";
import { ENABLED_KINDS, type CreationKind } from "@/widgets/create/registry";

export function KindSelect({
    value,
    onChange,
    t,
}: {
    value: CreationKind;
    onChange: (k: CreationKind) => void;
    t: (k: string) => string;
}): ReactElement {
    return (
        <FieldSelect
            label={t("kind")}
            value={value}
            onChange={(v) => onChange(v as CreationKind)}
            options={ENABLED_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            help={t("kindHelp")}
        />
    );
}
