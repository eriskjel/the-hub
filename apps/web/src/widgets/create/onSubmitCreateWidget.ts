import { API } from "@/lib/apiRoutes";
import type { BaseForm } from "./useCreateWidgetForm";

export async function onSubmitCreateWidget(
    v: BaseForm,
    opts: {
        onSuccess: () => void;
        onError: (message: string) => void;
    }
) {
    try {
        const res = await fetch(API.widgets.create, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: v.title,
                kind: v.kind,
                settings: v.settings,
                grid: { x: 0, y: 0, w: 1, h: 1 },
            }),
        });

        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || "Failed to create widget");
        }
        opts.onSuccess();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        opts.onError(msg);
    }
}
