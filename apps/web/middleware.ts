import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
    // 1) Run Supabase first so token refresh writes cookies
    const supabaseResponse = await updateSession(request);

    // 2) Then let next-intl decide on redirects/rewrites
    const intlResponse = intlMiddleware(request);
    if (intlResponse) {
        // Copy over any cookies Supabase set (like refreshed tokens)
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            intlResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return intlResponse;
    }

    // 3) Otherwise continue with the response that has Supabase cookies
    return supabaseResponse;
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
