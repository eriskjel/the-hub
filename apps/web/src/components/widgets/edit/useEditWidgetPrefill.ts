"use client";

import {useEffect} from "react";
import type {UseFormReturn} from "react-hook-form";
import type {AnyWidget} from "@/widgets/schema";
import type {EditableKind} from "@/widgets/create/registry";
import type {BaseForm} from "@/widgets/create/useCreateWidgetForm";

type EditableWidget = Extract<AnyWidget, { kind: EditableKind }>;

function buildEditDefaults(widget: EditableWidget): BaseForm {
    return {
        title: widget.title ?? "",
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
