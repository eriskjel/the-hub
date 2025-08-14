import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  // only allow relative 'next'
  if (!next.startsWith("/")) next = "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const fwdHost = req.headers.get("x-forwarded-host");
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) return NextResponse.redirect(`${origin}${next}`);
      if (fwdHost) return NextResponse.redirect(`https://${fwdHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
