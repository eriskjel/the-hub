import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/utils/supabase/server";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { deriveEffectiveRole } from "@/lib/auth/role";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") ?? 20)));
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const supabase = await createServerAuthClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meta = user.app_metadata as Record<string, unknown>;
    const rolesRaw = meta.roles;
    const roleRaw = meta.role;

    const roles = Array.isArray(rolesRaw)
        ? rolesRaw.filter((r): r is string => typeof r === "string")
        : [];

    const single = typeof roleRaw === "string" ? roleRaw : undefined;

    const effective = deriveEffectiveRole(roles, single);

    if (effective !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const out = await listUsersAdmin({ page, perPage, q });
    return NextResponse.json(out);
}
