import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Let next-intl handle locale redirects/re-writes first.
  const intlResponse = intlMiddleware(request);
  if (intlResponse) return intlResponse;

  // Then run  Supabase session middleware
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api|auth/callback|auth/confirm|auth/actions).*)",
  ],
};
