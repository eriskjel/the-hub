import { createWidget } from "@/lib/widgets/createWidget";
import type { BaseForm } from "./useCreateWidgetForm";

export async function onSubmitCreateWidget(
    v: BaseForm,
    opts: { onSuccess: () => void; onError: (message: string) => void }
) {
    const res = await createWidget({
        title: v.title,
        kind: v.kind,
        settings: v.settings,
        grid: { x: 0, y: 0, w: 1, h: 1 },
    });

    if (res.ok) {
        opts.onSuccess();
    } else {
        opts.onError(res.error);
    }
}
