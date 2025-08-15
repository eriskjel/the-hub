"use client";

import { createClient } from "@/utils/supabase/client";
import { getBaseUrl } from "@/utils/url";

export async function startGithubOAuth(locale: string, next = "/dashboard") {
  const supabase = createClient();
  const base = getBaseUrl();
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${base}auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`,
      },
    });
    if (error) {
      // Send to your existing error page with a code
      window.location.assign(`/${locale}/login?error=oauth-start-failed`);
    }
  } catch (e) {
    window.location.assign(`/${locale}/login?error=oauth-exception`);
  }
}
