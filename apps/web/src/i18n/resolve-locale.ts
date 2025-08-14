import { getLocale } from "next-intl/server";
import { headers, cookies } from "next/headers";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];
const isSupported = (x: string): x is Locale =>
  (routing.locales as ReadonlyArray<string>).includes(x);

export async function resolveLocale(): Promise<Locale> {
  // 1) Prefer Referer (server actions)
  try {
    const hdrs = await headers();
    const ref = hdrs.get("referer");
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    if (ref && host) {
      const url = new URL(ref);
      if (url.host === host) {
        const seg = url.pathname.split("/")[1];
        if (isSupported(seg)) return seg;
      }
    }
  } catch {
    /* ignore */
  }

  // 2) Next-intl (works when the request is under /[locale])
  try {
    const l = await getLocale();
    if (isSupported(l)) return l;
  } catch {
    /* ignore */
  }

  // 3) Cookie (middleware may not set this when URLs are already prefixed)
  try {
    const c = (await cookies()).get("NEXT_LOCALE")?.value;
    if (c && isSupported(c)) return c;
  } catch {
    /* ignore */
  }

  // 4) Fallback
  return routing.defaultLocale;
}
