import "server-only";

import { AnyWidget } from "@/types/widgets/types";
import { createClient } from "@/utils/supabase/server";
import { toAnyWidget, WidgetListItem } from "@/types/widgets/list";

export async function getWidgets(): Promise<AnyWidget[]> {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) {
        throw new Error("Failed to load widgets: no access token in session");
    }

    const res = await fetch(`${process.env.BACKEND_URL}/api/widgets/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!res.ok) {
        // Helpful debugging:
        const body = await res.text().catch(() => "");
        throw new Error(`Failed to load widgets: ${res.status} ${res.statusText} ${body}`);
    }

    const rows: WidgetListItem[] = await res.json();
    return rows.map(toAnyWidget);
}
