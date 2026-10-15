import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAdminFromUser } from "@/lib/auth/isAdmin";
import { listUsersAdmin } from "@/lib/admin/users.server";
import { parseUsersQuery } from "@/lib/admin/users";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error || !user)
        return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    if (!isAdminFromUser(user))
        return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    const params = request.nextUrl.searchParams;
    const query = parseUsersQuery({
        page: params.get("page") ?? undefined,
        per: params.get("per") ?? undefined,
        q: params.get("q") ?? undefined,
    });
    try {
        return NextResponse.json(await listUsersAdmin(query), { headers });
    } catch {
        return NextResponse.json({ error: "unavailable" }, { status: 500, headers });
    }
}
