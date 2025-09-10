import { createWidget } from "@/lib/widgets/createWidget";
import type { BaseForm } from "./useCreateWidgetForm";

export async function onSubmitCreateWidget(
    v: BaseForm,
    opts: { onSuccess: () => void; onError: (message: string) => void }
) {
    const res = await createWidget({
        kind: v.kind,
        settings: v.settings,
    });

    if (res.ok) {
        opts.onSuccess();
    } else {
        const normalized = normalizeCreateCode(res.error, v);
        opts.onError(normalized);
    }
}

function normalizeCreateCode(code: string, v: BaseForm): string {
    if (code !== "duplicate") return code;

    if (v.kind === "countdown") {
        const src = (v.settings as { source?: string } | undefined)?.source;
        if (src === "provider") return "duplicate_provider";
    }
    if (v.kind === "server-pings") return "duplicate_target";
    if (v.kind === "grocery-deals") return "duplicate_groceries";
    return code;
}
