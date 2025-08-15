"use client";

import { createClient } from "@/utils/supabase/client";
import { getBaseUrl } from "@/utils/url";

export async function startGithubOAuth(locale: string, next = "/dashboard") {
    const supabase = createClient();
    const base = getBaseUrl();
    const localizedNext = next.startsWith(`/${locale}/`) ? next : `/${locale}${next}`;
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
                redirectTo: `${base}auth/callback?next=${encodeURIComponent(localizedNext)}&locale=${locale}`,
            },
        });
        if (error) window.location.assign(`/${locale}/login?error=oauth-start-failed`);
    } catch {
        window.location.assign(`/${locale}/login?error=oauth-exception`);
    }
}
