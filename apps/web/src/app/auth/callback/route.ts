import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureDefaultRole } from "@/app/auth/actions/ensureDefaultRose";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") || "/";

  // allow only relative paths
  if (!next.startsWith("/")) next = "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await ensureDefaultRole();
      // respect current origin automatically (dev/prod/proxy-safe)
      return NextResponse.redirect(new URL(next, url));
    }
  }

  // fallback on failure
  return NextResponse.redirect(new URL("/auth/auth-code-error", url));
}
