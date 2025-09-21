import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/utils/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
    const response = handleI18nRouting(request) ?? NextResponse.next();
    // Pass the *same* response through Supabase updater
    return await updateSession(request, response);
}

export const config = {
    matcher: [
        // Run middleware on everything EXCEPT:
        // - _next/*
        // - /drinks/*  <-- explicitly skip your static drinks folder
        // - image/static assets (png, jpg, webp, etc.)
        // - api/*
        // - auth endpoints
        "/((?!_next|drinks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api|auth/callback|auth/confirm|auth/actions).*)",
    ],
};
