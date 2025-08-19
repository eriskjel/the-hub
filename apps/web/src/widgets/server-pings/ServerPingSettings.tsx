import type { UseFormReturn } from "react-hook-form";
import type { CreateWidgetFormValues } from "@/widgets/create/registry";

export function ServerPingsSettings({
    form,
}: {
    form: UseFormReturn<CreateWidgetFormValues, unknown, CreateWidgetFormValues>;
}) {
    return (
        <div className="rounded-xl border border-neutral-200 p-3 text-left">
            <div className="mb-2 text-sm text-neutral-700">
                <strong>Server pings</strong> — set a URL to ping.
            </div>
            <label className="mb-1 block text-sm font-medium">Target URL</label>
            <input
                {...form.register("settings.target")}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="https://example.com/health"
            />
            <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.settings?.target?.message}
            </p>
        </div>
    );
}
