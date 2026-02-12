"use client";

import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { AnyWidget, CountdownSettings } from "@/widgets/schema";
import type { EditableKind } from "@/widgets/create/registry";
import type { BaseForm } from "@/widgets/create/useCreateWidgetForm";

type EditableWidget = Extract<AnyWidget, { kind: EditableKind }>;

const COUNTDOWN_DEFAULTS: CountdownSettings = {
    source: "provider",
    provider: "trippel-trumf",
    showHours: true,
};

function normalizeCountdownSettings(raw: unknown): CountdownSettings {
    if (typeof raw !== "object" || raw === null) return COUNTDOWN_DEFAULTS;
    const o = raw as Record<string, unknown>;
    const validProvider =
        o.source === "provider" &&
        (o.provider === "trippel-trumf" || o.provider === "dnb-supertilbud");
    return {
        source: "provider",
        provider: validProvider ? (o.provider as CountdownSettings["provider"]) : "trippel-trumf",
        showHours: typeof o.showHours === "boolean" ? o.showHours : true,
    };
}

function buildEditDefaults(widget: EditableWidget): BaseForm {
    if (widget.kind === "countdown") {
        return {
            kind: "countdown",
            settings: normalizeCountdownSettings(widget.settings ?? {}),
        };
    }
    return {
        kind: widget.kind,
        settings: widget.settings ?? {},
    };
}

/** Prefill RHF form when the widget changes. No `any`. */
export function useEditWidgetPrefill(form: UseFormReturn<BaseForm>, widget: EditableWidget) {
    useEffect(() => {
        form.reset(buildEditDefaults(widget));
    }, [form, widget]);
}
